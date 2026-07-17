import type { Message } from '../types';
import { generateOnce } from './ollama';

// Caps on the summarization request itself so it can't overflow num_ctx:
// each message contributes at most 1000 chars, the whole excerpt at most
// ~12000 chars (~3k tokens). Oldest lines are dropped beyond that — accepted
// lossy degradation.
const MSG_CAP = 1000;
const TOOL_RESULT_CAP = 300;
const EXCERPT_CAP = 12000;

const SUMMARY_PROMPT = `### Task:
Summarize the conversation excerpt below in under 300 words. This summary will
be the assistant's ONLY memory of these messages in future replies, so preserve:
- key facts, names, numbers, dates, and decisions
- what the user asked for and what was concluded or produced
- any user preferences, constraints, or corrections
Write compact plain prose. No headings, no bullet points, no preamble — start
directly with the summary.

### Previous summary (fold its facts into your new summary — do not lose them):
`;

function renderExcerpt(messages: Message[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    lines.push(`${m.role.toUpperCase()}: ${m.content.slice(0, MSG_CAP)}`);
    if (m.toolCalls) {
      for (const c of m.toolCalls) {
        lines.push(`TOOL(${c.name}): ${(c.result ?? '(no result)').slice(0, TOOL_RESULT_CAP)}`);
      }
    }
  }
  // Drop oldest lines until the excerpt fits.
  let total = lines.reduce((a, l) => a + l.length + 1, 0);
  while (lines.length > 1 && total > EXCERPT_CAP) {
    total -= lines[0].length + 1;
    lines.shift();
  }
  return lines.join('\n');
}

/**
 * One-shot background call that folds the to-be-evicted span (plus any
 * previous rolling summary) into a new summary. Returns null on any failure —
 * the caller then leaves the checkpoint untouched and the next send degrades
 * to a plain sliding window.
 */
export async function summarizeSpan(
  baseUrl: string,
  model: string,
  previousSummary: string | undefined,
  span: Message[]
): Promise<string | null> {
  if (span.length === 0) return null;
  try {
    const prompt =
      SUMMARY_PROMPT +
      (previousSummary?.trim() || '(none)') +
      '\n\n### Conversation excerpt:\n' +
      renderExcerpt(span);
    const { content } = await generateOnce(
      baseUrl,
      model,
      [{ role: 'user', content: prompt }],
      { numPredict: 400 }
    );
    const text = content.trim();
    return text || null;
  } catch {
    return null;
  }
}
