import { create } from 'zustand';
import type { RagChunk, RagDocument } from '../types';
import { chunkText, extractText, validateDoc } from '../utils/docUtils';
import {
  embedPrefix,
  embedTexts,
  EmbedModelMissingError,
  generateOnce,
} from '../services/ollama';
import {
  deleteDocument,
  listDocuments,
  normalizeVector,
  putChunks,
  putDocument,
  updateDocStatus,
} from '../services/vectorStore';
import { estimateTextTokens } from '../utils/tokenEstimate';
import { generateId } from '../utils/generateId';
import { useChatStore } from './chatStore';
import { useConnectionStore } from './connectionStore';

// Documents at or below this token count are handled "inline": the whole text
// is injected into context every turn (like a Claude chat attachment). Larger
// docs switch to retrieval (chunk + embed + summary). Kept well under
// PROMPT_BUDGET so inline docs still leave room for history and the answer.
const INLINE_MAX_TOKENS = 8000;

// How many chunk texts to embed per /api/embed request (rag mode only).
const EMBED_BATCH = 48;

// Chars of a large doc fed to the summarizer (rag mode). Enough for a global
// overview without blowing the summarizer's own context.
const SUMMARY_SOURCE_CHARS = 16000;

interface DocState {
  documents: RagDocument[]; // mirror of IndexedDB metadata (source of truth is IndexedDB)
  progress: Record<string, { done: number; total: number }>; // docId -> embed progress
  hydrate: () => Promise<void>;
  // Ingest a file end to end. Resolves with the new document id (final status
  // may be 'ready' or 'error'). Small docs go inline (no embedding needed);
  // large docs are chunked, embedded, and summarized. `onStart` fires with the
  // new id as soon as the record exists, so the composer can stage its chip
  // before ingestion finishes.
  ingest: (
    file: File,
    baseUrl: string,
    embedModel: string,
    onStart?: (id: string) => void
  ) => Promise<string>;
  remove: (docId: string) => Promise<void>;
}

export const useDocStore = create<DocState>((set) => ({
  documents: [],
  progress: {},

  hydrate: async () => {
    try {
      const documents = await listDocuments();
      set({ documents });
    } catch (err) {
      console.warn('[docStore] hydrate failed', err);
    }
  },

  ingest: async (file, baseUrl, embedModel, onStart) => {
    const id = generateId();
    onStart?.(id);

    const patchDoc = (patch: Partial<RagDocument>) =>
      set((state) => ({
        documents: state.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }));

    const validation = validateDoc(file);
    const doc: RagDocument = {
      id,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      bytes: file.size,
      status: validation.valid ? 'parsing' : 'error',
      error: validation.error,
      created: Date.now(),
    };

    set((state) => ({ documents: [doc, ...state.documents] }));
    if (!validation.valid) return id;
    await putDocument(doc);

    try {
      // 1. Extract text and classify by size.
      const segments = await extractText(file);
      const fullText = segments.map((s) => s.text).join('\n\n').trim();
      if (!fullText) {
        throw new Error('No extractable text (is this a scanned or image-only PDF?)');
      }
      const tokenCount = estimateTextTokens(fullText);

      if (tokenCount <= INLINE_MAX_TOKENS) {
        // --- Inline mode: whole text lives in context, no embedding needed. ---
        patchDoc({ mode: 'inline', tokenCount, fullText, status: 'ready' });
        await updateDocStatus(id, 'ready', { mode: 'inline', tokenCount, fullText });
        return id;
      }

      // --- RAG mode: chunk + embed + summarize. Requires the embed model. ---
      patchDoc({ mode: 'rag', tokenCount, status: 'chunking' });
      await updateDocStatus(id, 'chunking', { mode: 'rag', tokenCount });

      const chunks = chunkText(segments);
      patchDoc({ status: 'embedding' });
      await updateDocStatus(id, 'embedding');
      set((state) => ({
        progress: { ...state.progress, [id]: { done: 0, total: chunks.length } },
      }));

      const docPrefix = embedPrefix(embedModel, 'document');
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH);
        const vectors = await embedTexts(
          baseUrl,
          embedModel,
          batch.map((c) => docPrefix + c.text)
        );
        const records: RagChunk[] = batch.map((c, j) => ({
          id: `${id}:${c.index}`,
          docId: id,
          index: c.index,
          text: c.text,
          embedding: normalizeVector(vectors[j]),
          page: c.page,
        }));
        await putChunks(records);
        set((state) => ({
          progress: {
            ...state.progress,
            [id]: { done: Math.min(i + batch.length, chunks.length), total: chunks.length },
          },
        }));
      }

      // A one-time summary gives the model global awareness even when the
      // retrieved chunks miss (e.g. "summarize the whole document").
      patchDoc({ status: 'summarizing', chunkCount: chunks.length, embedModel });
      await updateDocStatus(id, 'summarizing', { chunkCount: chunks.length, embedModel });
      const summary = await summarizeDocument(baseUrl, fullText);

      patchDoc({ status: 'ready', summary, error: undefined });
      await updateDocStatus(id, 'ready', { summary });
    } catch (err) {
      const message =
        err instanceof EmbedModelMissingError
          ? `${err.message} Run \`ollama pull ${embedModel}\` on your Ollama server.`
          : err instanceof DOMException && err.name === 'QuotaExceededError'
            ? 'Out of browser storage — delete some documents and try again.'
            : err instanceof Error
              ? err.message
              : String(err);
      patchDoc({ status: 'error', error: message });
      try {
        await deleteDocument(id);
        await putDocument({ ...doc, status: 'error', error: message });
      } catch {
        // best effort
      }
    } finally {
      set((state) => {
        const next = { ...state.progress };
        delete next[id];
        return { progress: next };
      });
    }

    return id;
  },

  remove: async (docId) => {
    try {
      await deleteDocument(docId);
    } catch (err) {
      console.warn('[docStore] delete failed', err);
    }
    set((state) => ({ documents: state.documents.filter((d) => d.id !== docId) }));
    useChatStore.getState().purgeDocFromAllConversations(docId);
  },
}));

// Summarize a large document for its rag-mode global-awareness note. Uses the
// current chat model via the existing non-streaming meta path; on failure the
// summary is simply omitted (retrieval still works).
async function summarizeDocument(baseUrl: string, fullText: string): Promise<string | undefined> {
  const model = useConnectionStore.getState().currentModel;
  if (!model) return undefined;
  const source = fullText.slice(0, SUMMARY_SOURCE_CHARS);
  try {
    const { content } = await generateOnce(
      baseUrl,
      model,
      [
        {
          role: 'user',
          content:
            'Summarize the following document in 4-6 sentences, capturing its main topics, key entities, and overall structure so it can serve as an index. Reply with only the summary.\n\n---\n' +
            source,
        },
      ],
      { numPredict: 300 }
    );
    return content.trim() || undefined;
  } catch (err) {
    console.warn('[docStore] summary generation failed', err);
    return undefined;
  }
}
