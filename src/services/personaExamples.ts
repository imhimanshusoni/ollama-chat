// Retrieval-backed persona few-shot. The persona's example exchanges are
// embedded once into IndexedDB; per message we retrieve the most relevant ones
// to inject as few-shot — so the persona can draw on a large bank of examples
// without cramming them all into the prompt. This is the bridge between a few
// canned examples and a fine-tune.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { embedPrefix, embedTexts } from './ollama';
import { normalizeVector } from './vectorStore';
import type { OllamaMessage } from '../types';
import type { Persona } from './persona';

export interface ExamplePair {
  user: string;
  assistant: string;
}

interface StoredExample extends ExamplePair {
  id: string;
  embedding: Float32Array;
}

interface PersonaDB extends DBSchema {
  examples: { key: string; value: StoredExample };
  meta: { key: string; value: { key: string; hash: string } };
}

const DB_NAME = 'ollama-persona';
const DB_VERSION = 1;
const EMBED_BATCH = 48;

let dbPromise: Promise<IDBPDatabase<PersonaDB>> | null = null;
function getDb(): Promise<IDBPDatabase<PersonaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PersonaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('examples', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// In-memory cache of the current bank, so retrieval doesn't hit IndexedDB per
// message. Keyed by the bank hash so a persona edit invalidates it.
let bank: StoredExample[] = [];
let bankHash: string | null = null;

// Pair the flat alternating examples array into standalone (user→assistant)
// exchanges. Each pair is an independent style demo used for retrieval.
function pairExamples(examples: OllamaMessage[]): ExamplePair[] {
  const pairs: ExamplePair[] = [];
  for (let i = 0; i + 1 < examples.length; i += 2) {
    const u = examples[i];
    const a = examples[i + 1];
    if (u.role === 'user' && a.role === 'assistant' && u.content && a.content) {
      pairs.push({ user: u.content, assistant: a.content });
    }
  }
  return pairs;
}

// Small stable string hash (djb2) — identifies a bank version.
function hashPairs(pairs: ExamplePair[]): string {
  const s = JSON.stringify(pairs);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export function isBankReady(): boolean {
  return bank.length > 0;
}

/**
 * Ensure the persona's example bank is embedded and loaded into memory. Cheap
 * no-op if already synced this session. Reuses stored embeddings across reloads
 * (keyed by a hash of the examples), only re-embedding when the persona changes.
 * Requires an embedding model on the server; callers should gate on that.
 */
export async function syncExampleBank(
  persona: Persona,
  baseUrl: string,
  embedModel: string
): Promise<void> {
  const pairs = pairExamples(persona.examples);
  const hash = hashPairs(pairs);
  if (bankHash === hash && bank.length > 0) return; // already current in memory
  if (pairs.length === 0) {
    bank = [];
    bankHash = hash;
    return;
  }

  const db = await getDb();
  const storedHash = (await db.get('meta', 'bank'))?.hash;
  if (storedHash === hash) {
    // Embeddings already persisted for this exact bank — just load them.
    bank = await db.getAll('examples');
    bankHash = hash;
    if (bank.length > 0) return;
  }

  // Re-embed the whole bank (persona changed or first run).
  const docPrefix = embedPrefix(embedModel, 'document');
  const records: StoredExample[] = [];
  for (let i = 0; i < pairs.length; i += EMBED_BATCH) {
    const batch = pairs.slice(i, i + EMBED_BATCH);
    const vectors = await embedTexts(baseUrl, embedModel, batch.map((p) => docPrefix + p.user));
    batch.forEach((p, j) => {
      records.push({ id: `${i + j}`, user: p.user, assistant: p.assistant, embedding: normalizeVector(vectors[j]) });
    });
  }

  const tx = db.transaction(['examples', 'meta'], 'readwrite');
  await tx.objectStore('examples').clear();
  for (const r of records) await tx.objectStore('examples').put(r);
  await tx.objectStore('meta').put({ key: 'bank', hash });
  await tx.done;

  bank = records;
  bankHash = hash;
}

/**
 * Top-k example pairs most relevant to the current user message, by cosine
 * similarity (embeddings are normalized). Returns [] if the bank isn't ready
 * or embedding fails — the caller falls back to a static slice.
 */
export async function retrieveExamples(
  query: string,
  baseUrl: string,
  embedModel: string,
  k: number,
  signal?: AbortSignal
): Promise<ExamplePair[]> {
  if (bank.length === 0 || !query.trim()) return [];
  try {
    const [vec] = await embedTexts(baseUrl, embedModel, [embedPrefix(embedModel, 'query') + query], signal);
    if (!vec) return [];
    const q = normalizeVector(vec);
    const dim = q.length;
    const scored = bank
      .filter((e) => e.embedding.length === dim)
      .map((e) => {
        let s = 0;
        for (let i = 0; i < dim; i++) s += e.embedding[i] * q[i];
        return { pair: { user: e.user, assistant: e.assistant }, score: s };
      });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.pair);
  } catch {
    return [];
  }
}
