// Builds the document context injected into the chat every turn. Size-adaptive
// (mirrors Claude): inline docs contribute their full text; rag docs contribute
// a summary plus the chunks retrieved for the current query. Retrieval runs here
// (caller-side) rather than as a model-invoked tool, so attached docs are always
// available without depending on a small local model choosing to search.

import { embedPrefix, embedTexts } from './ollama';
import { normalizeVector, searchChunks } from './vectorStore';
import { estimateTextTokens } from '../utils/tokenEstimate';
import type { RagDocument, RetrievedChunk } from '../types';

const RAG_TOP_K = 6;
const RAG_MIN_SCORE = 0.2;
// Cap on the whole injected block so a big doc can't evict all conversation
// history. Inline docs are already bounded (INLINE_MAX_TOKENS in docStore).
const DOC_CONTEXT_MAX_TOKENS = 12000;
// Per-excerpt cap. Must exceed the max chunk size (~1000 + overlap in docUtils)
// so a retrieved chunk is never truncated mid-content — otherwise a fact near
// the end of a chunk (after the cap) would be silently dropped from context.
const PER_EXCERPT_CHARS = 1400;

export interface DocContextResult {
  text: string; // block to inject ('' when there's nothing to add)
  tokens: number; // estimated tokens of `text`, for prompt-budget accounting
}

const EMPTY: DocContextResult = { text: '', tokens: 0 };

export async function buildDocContext(
  docs: RagDocument[],
  query: string,
  baseUrl: string,
  embedModel: string,
  signal?: AbortSignal
): Promise<DocContextResult> {
  const ready = docs.filter((d) => d.status === 'ready');
  if (ready.length === 0) return EMPTY;

  const budgetChars = DOC_CONTEXT_MAX_TOKENS * 4;
  const parts: string[] = [];
  let used = 0;

  // 1. Inline docs — whole text (already size-bounded at ingest).
  for (const d of ready) {
    if (d.mode !== 'inline' || !d.fullText) continue;
    const header = `=== Document: ${d.name} ===\n`;
    if (used + header.length + 200 > budgetChars) break;
    const room = budgetChars - used - header.length;
    const body = d.fullText.length > room ? d.fullText.slice(0, room) + '\n…(truncated)' : d.fullText;
    parts.push(header + body);
    used += header.length + body.length;
  }

  // 2. RAG docs — summary for global awareness + retrieved chunks for the query.
  const ragDocs = ready.filter((d) => d.mode === 'rag');
  if (ragDocs.length > 0 && used < budgetChars) {
    for (const d of ragDocs) {
      if (!d.summary) continue;
      const block = `=== Document: ${d.name} (overview) ===\n${d.summary}`;
      if (used + block.length > budgetChars) break;
      parts.push(block);
      used += block.length;
    }

    if (query.trim() && used < budgetChars) {
      let hits: RetrievedChunk[] = [];
      try {
        const [vec] = await embedTexts(
          baseUrl,
          embedModel,
          [embedPrefix(embedModel, 'query') + query],
          signal
        );
        if (vec) {
          hits = (await searchChunks(normalizeVector(vec), ragDocs.map((d) => d.id), RAG_TOP_K))
            .filter((h) => h.score >= RAG_MIN_SCORE);
        }
      } catch (err) {
        // Retrieval failure (e.g. embed model missing) must not break the turn —
        // the summaries above still give the model something to work with.
        console.warn('[docContext] retrieval failed', err);
      }

      if (hits.length > 0) {
        const lines = ['=== Relevant excerpts ==='];
        for (let i = 0; i < hits.length; i++) {
          const h = hits[i];
          const src = h.page ? `${h.docName} (p.${h.page})` : h.docName;
          const excerpt =
            h.text.length > PER_EXCERPT_CHARS ? h.text.slice(0, PER_EXCERPT_CHARS) + '…' : h.text;
          const line = `[${i + 1}] ${src}: ${excerpt}`;
          if (used + line.length > budgetChars) break;
          lines.push(line);
          used += line.length;
        }
        if (lines.length > 1) parts.push(lines.join('\n'));
      }
    }
  }

  if (parts.length === 0) return EMPTY;
  const text = parts.join('\n\n');
  return { text, tokens: estimateTextTokens(text) };
}
