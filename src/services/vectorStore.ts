// IndexedDB-backed vector store for RAG. Documents and their embedded chunks
// live here — NOT in localStorage/Zustand-persist, which is near quota and
// strips even images (see chatStore partialize). Float32Array embeddings are
// structured-clone native, so they store without base64/JSON bloat.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RagChunk, RagDocument, RetrievedChunk } from '../types';

interface RagDB extends DBSchema {
  documents: {
    key: string; // RagDocument.id
    value: RagDocument;
  };
  chunks: {
    key: string; // RagChunk.id (`${docId}:${index}`)
    value: RagChunk;
    indexes: { 'by-doc': string }; // RagChunk.docId
  };
}

const DB_NAME = 'ollama-rag';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RagDB>> | null = null;

function getDb(): Promise<IDBPDatabase<RagDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RagDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('documents', { keyPath: 'id' });
        const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunkStore.createIndex('by-doc', 'docId');
      },
    });
  }
  return dbPromise;
}

export async function putDocument(doc: RagDocument): Promise<void> {
  const db = await getDb();
  await db.put('documents', doc);
}

export async function updateDocStatus(
  id: string,
  status: RagDocument['status'],
  extra?: Partial<RagDocument>
): Promise<void> {
  const db = await getDb();
  const doc = await db.get('documents', id);
  if (!doc) return;
  await db.put('documents', { ...doc, status, ...extra });
}

export async function putChunks(chunks: RagChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('chunks', 'readwrite');
  await Promise.all(chunks.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function listDocuments(): Promise<RagDocument[]> {
  const db = await getDb();
  const docs = await db.getAll('documents');
  return docs.sort((a, b) => b.created - a.created);
}

export async function getDocument(id: string): Promise<RagDocument | undefined> {
  const db = await getDb();
  return db.get('documents', id);
}

// Remove a document and all of its chunks (cascade via the by-doc index).
export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['documents', 'chunks'], 'readwrite');
  await tx.objectStore('documents').delete(id);
  const chunkStore = tx.objectStore('chunks');
  const index = chunkStore.index('by-doc');
  let cursor = await index.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Top-k nearest chunks across the given documents, by cosine similarity.
 * Embeddings are stored L2-normalized, so cosine == dot product. Only chunks
 * for `docIds` are scanned (cursor over the by-doc index), never the whole
 * store, so the scan stays small even with a large global library.
 *
 * Brute force is sub-100ms to ~20-50k scanned chunks. If a single conversation
 * ever attaches libraries beyond that, move this scan into a Web Worker or
 * adopt an approximate index (e.g. hnsw-wasm).
 */
export async function searchChunks(
  queryEmbedding: Float32Array,
  docIds: string[],
  k: number
): Promise<RetrievedChunk[]> {
  if (docIds.length === 0 || k <= 0) return [];

  const db = await getDb();
  // Doc names for citations, resolved once up front.
  const nameById = new Map<string, string>();
  for (const id of docIds) {
    const doc = await db.get('documents', id);
    if (doc) nameById.set(id, doc.name);
  }

  const dim = queryEmbedding.length;
  // Bounded top-k, kept sorted descending so top[length-1] is the true current
  // minimum. k is small (a few), so re-sorting on each accepted candidate is
  // cheaper than any heap machinery.
  const top: RetrievedChunk[] = [];

  const index = db.transaction('chunks').store.index('by-doc');
  for (const docId of docIds) {
    let cursor = await index.openCursor(IDBKeyRange.only(docId));
    while (cursor) {
      const chunk = cursor.value;
      const emb = chunk.embedding;
      if (emb.length === dim) {
        let score = 0;
        for (let i = 0; i < dim; i++) score += emb[i] * queryEmbedding[i];
        if (top.length < k || score > top[top.length - 1].score) {
          top.push({
            docId: chunk.docId,
            docName: nameById.get(chunk.docId) ?? chunk.docId,
            index: chunk.index,
            page: chunk.page,
            text: chunk.text,
            score,
          });
          top.sort((a, b) => b.score - a.score);
          if (top.length > k) top.length = k;
        }
      }
      cursor = await cursor.continue();
    }
  }

  return top;
}

// L2-normalize a raw embedding into a Float32Array so downstream similarity is
// a bare dot product. A zero vector is returned as-is (all zeros).
export function normalizeVector(vec: number[]): Float32Array {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  const out = new Float32Array(vec.length);
  if (norm === 0) return out;
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}
