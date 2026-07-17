import type { Message } from '../types';

// Rough token estimation without a tokenizer: ~4 chars per token, +4 per
// message for role/formatting overhead, a flat 1000 per image. Calibrated
// against Ollama's reported prompt_eval_count where available (contextWindow).

// Max chars of a tool result replayed into history. Lives here so the
// estimator and the replayer (buildOllamaHistory) can't drift apart.
export const TOOL_RESULT_CAP = 1500;

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4) + 4;
}

// Deliberately conservative for tool-bearing messages: buildOllamaHistory
// replays only the most recent tool turns in full and collapses older ones to
// a one-line note, so this overestimates old tool turns (evicting slightly
// early is safe; overflowing num_ctx is not).
export function estimateMessageTokens(m: Message): number {
  let chars = m.content.length;
  if (m.toolCalls) {
    for (const c of m.toolCalls) {
      chars += c.name.length + JSON.stringify(c.arguments).length;
      chars += Math.min(c.result?.length ?? 0, TOOL_RESULT_CAP);
    }
  }
  return Math.ceil(chars / 4) + 4 + 1000 * (m.images?.length ?? 0);
}
