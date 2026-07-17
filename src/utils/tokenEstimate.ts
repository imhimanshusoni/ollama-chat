import type { Message } from '../types';

// Rough token estimation without a tokenizer: ~4 chars per token, +4 per
// message for role/formatting overhead, a flat 1000 per image. Calibrated
// against Ollama's reported prompt_eval_count where available (contextWindow).

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4) + 4;
}

export function estimateMessageTokens(m: Message): number {
  let chars = m.content.length;
  if (m.toolCalls) {
    for (const c of m.toolCalls) {
      // Mirrors what buildOllamaHistory replays: call JSON + capped result.
      chars += c.name.length + JSON.stringify(c.arguments).length;
      chars += Math.min(c.result?.length ?? 0, 1500);
    }
  }
  return Math.ceil(chars / 4) + 4 + 1000 * (m.images?.length ?? 0);
}
