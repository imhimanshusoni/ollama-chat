import type { ContextSummary, Message, TokenStats } from '../types';
import { NUM_CTX } from './ollama';
import { estimateMessageTokens, estimateTextTokens } from '../utils/tokenEstimate';

// Reserve room for the model's answer (and intra-turn tool results). If
// done_reason "length" starts showing up in practice, bump to 2048.
const OUTPUT_RESERVE = 1536;
export const PROMPT_BUDGET = NUM_CTX - OUTPUT_RESERVE;

// Headroom assumed for the upcoming user message when deciding whether to
// pre-summarize in the background after a completed response.
const NEXT_TURN_ALLOWANCE = 1000;

export interface ContextResult {
  history: Message[];
  summaryText?: string;
  // Index into `messages` where history begins.
  windowStart: number;
  // Messages between the summary checkpoint and the window start — the span
  // a rolling summary needs to cover.
  evicted: Message[];
}

interface ConversationContext {
  contextSummary?: ContextSummary;
  lastTokenStats?: TokenStats;
}

/**
 * Per-message token estimates, scaled so that the span covered by Ollama's
 * last reported counts sums to the actual value (ground truth beats chars/4).
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
    const actual = Math.max(1, stats.promptEvalCount + stats.evalCount - fixedTokens);
    if (spanSum > 0) {
      const scale = actual / spanSum;
      for (let i = checkpoint; i < stats.atMessageCount; i++) est[i] = est[i] * scale;
    }
  }
  return est;
}

function windowFor(
  messages: Message[],
  est: number[],
  checkpoint: number,
  fixedTokens: number,
  budget: number
): number {
  const n = messages.length;
  const totalFromCheckpoint = fixedTokens + est.slice(checkpoint).reduce((a, b) => a + b, 0);
  if (totalFromCheckpoint <= budget) return checkpoint;

  // Walk backward from the newest message until the budget is exhausted.
  let start = n;
  let acc = fixedTokens;
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
  return start;
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
): ContextResult {
  const summary = conv.contextSummary;
  const checkpoint = Math.min(summary?.upToIndex ?? 0, messages.length);
  const fixed =
    estimateTextTokens(systemPrompt) + (summary ? estimateTextTokens(summary.text) : 0);
  const est = calibratedEstimates(messages, checkpoint, fixed, conv.lastTokenStats);
  const windowStart = windowFor(messages, est, checkpoint, fixed, PROMPT_BUDGET);

  return {
    history: messages.slice(windowStart),
    summaryText: summary?.text,
    windowStart,
    evicted: messages.slice(checkpoint, windowStart),
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
  const summary = conv.contextSummary;
  const checkpoint = Math.min(summary?.upToIndex ?? 0, messages.length);
  const fixed =
    estimateTextTokens(systemPrompt) + (summary ? estimateTextTokens(summary.text) : 0);
  const est = calibratedEstimates(messages, checkpoint, fixed, conv.lastTokenStats);
  const windowStart = windowFor(
    messages,
    est,
    checkpoint,
    fixed,
    PROMPT_BUDGET - NEXT_TURN_ALLOWANCE
  );
  return windowStart > checkpoint ? { from: checkpoint, to: windowStart } : null;
}
