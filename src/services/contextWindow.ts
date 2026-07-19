import type { ContextSummary, Message, TokenStats } from '../types';
import { NUM_CTX } from './ollama';
import { estimateMessageTokens, estimateTextTokens } from '../utils/tokenEstimate';

// Reserve room for the model's answer (and intra-turn tool results). With
// gemma4 thinking on by default, a turn emits a reasoning trace plus the
// answer before `done`, so this is generous. Bump further if done_reason
// "length" shows up in practice.
const OUTPUT_RESERVE = 4096;
const PROMPT_BUDGET = NUM_CTX - OUTPUT_RESERVE;

// Headroom assumed for the upcoming user message when deciding whether to
// pre-summarize in the background after a completed response.
const NEXT_TURN_ALLOWANCE = 1000;

interface ConversationContext {
  contextSummary?: ContextSummary;
  lastTokenStats?: TokenStats;
}

/**
 * Per-message token estimates, optionally corrected upward by Ollama's last
 * reported counts.
 *
 * Only upward: prompt_eval_count counts NEWLY evaluated tokens, so with the
 * model pinned (keep_alive -1) a KV-cached prefix makes the reported count
 * far smaller than the real prompt — a downward correction would collapse
 * every estimate toward zero and disable eviction entirely. An upward signal
 * can't be produced by caching, so it's trustworthy: it means the tokenizer
 * genuinely packs more tokens than chars/4 suggests (code, non-Latin text).
 */
function calibratedEstimates(
  messages: Message[],
  checkpoint: number,
  fixedTokens: number,
  stats?: TokenStats
): number[] {
  const est = messages.map(estimateMessageTokens);
  if (stats && stats.atMessageCount > checkpoint && stats.atMessageCount <= messages.length) {
    const spanSum = est.slice(checkpoint, stats.atMessageCount).reduce((a, b) => a + b, 0);
    const actual = stats.promptEvalCount + stats.evalCount - fixedTokens;
    if (spanSum > 0 && actual > spanSum) {
      const scale = Math.min(actual / spanSum, 3);
      for (let i = checkpoint; i < stats.atMessageCount; i++) est[i] = est[i] * scale;
    }
  }
  return est;
}

function computeWindow(
  conv: ConversationContext,
  messages: Message[],
  systemPrompt: string,
  budget: number
): { checkpoint: number; windowStart: number } {
  const summary = conv.contextSummary;
  const checkpoint = Math.min(summary?.upToIndex ?? 0, messages.length);
  const fixed =
    estimateTextTokens(systemPrompt) + (summary ? estimateTextTokens(summary.text) : 0);
  const est = calibratedEstimates(messages, checkpoint, fixed, conv.lastTokenStats);

  const n = messages.length;
  const total = fixed + est.slice(checkpoint).reduce((a, b) => a + b, 0);
  if (total <= budget) return { checkpoint, windowStart: checkpoint };

  // Walk backward from the newest message until the budget is exhausted.
  let start = n;
  let acc = fixed;
  for (let i = n - 1; i >= checkpoint; i--) {
    if (acc + est[i] > budget) break;
    acc += est[i];
    start = i;
  }
  // Snap forward to the next user message for clean role alternation.
  while (start < n && messages[start].role !== 'user') start++;
  // Degenerate case (single huge message): always send at least the last
  // user message and let Ollama truncate.
  if (start >= n) {
    start = n - 1;
    while (start > checkpoint && messages[start].role !== 'user') start--;
  }
  return { checkpoint, windowStart: start };
}

/**
 * Decides what actually gets sent: everything from the summary checkpoint if
 * it fits the prompt budget, otherwise the rolling summary plus the newest
 * messages that fit. `systemPrompt` is used only for token estimation.
 */
export function buildContext(
  conv: ConversationContext,
  messages: Message[],
  systemPrompt: string
): { history: Message[]; summaryText?: string } {
  const { windowStart } = computeWindow(conv, messages, systemPrompt, PROMPT_BUDGET);
  return {
    history: messages.slice(windowStart),
    summaryText: conv.contextSummary?.text,
  };
}

/**
 * After a completed response: the span the NEXT turn is likely to evict, so a
 * rolling summary can be prepared in the background. Null if nothing new
 * would be evicted.
 */
export function spanToSummarize(
  conv: ConversationContext,
  messages: Message[],
  systemPrompt: string
): { from: number; to: number } | null {
  const { checkpoint, windowStart } = computeWindow(
    conv,
    messages,
    systemPrompt,
    PROMPT_BUDGET - NEXT_TURN_ALLOWANCE
  );
  return windowStart > checkpoint ? { from: checkpoint, to: windowStart } : null;
}
