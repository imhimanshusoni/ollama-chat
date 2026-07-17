// System prompt for the chat itself. Background meta calls (title generation,
// history summarization) deliberately do NOT include this.

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant running on a local Ollama model. Be accurate and concise. Use Markdown formatting when it helps readability. If you don't know something, say so instead of guessing.`;

// Appended only when tools are actually being sent with the request, so the
// model is never told about tools it can't call.
export const TOOL_GUIDANCE = `You have these tools:
- web_search: use it for current events, news, prices, weather, product details, recent releases, or any fact that may have changed after your training data or that you are unsure about.
- get_current_time: use it whenever the current date or time matters.

Search rules:
- Use one or two broad, keyword-style searches rather than many narrow ones.
- If a search returns nothing useful, rephrase ONCE; never repeat an identical query.
- When your answer uses search results, cite the source URLs.`;

// When no search API key is configured, web_search isn't offered at all — the
// model must not be told about (or encouraged to use) a tool that can only fail.
export const TIME_ONLY_GUIDANCE = `You have one tool:
- get_current_time: use it whenever the current date or time matters.`;

export function buildSystemPrompt(
  override: string,
  toolsEnabled: boolean,
  searchEnabled = true
): string {
  const base = override.trim() || DEFAULT_SYSTEM_PROMPT;
  if (!toolsEnabled) return base;
  return `${base}\n\n${searchEnabled ? TOOL_GUIDANCE : TIME_ONLY_GUIDANCE}`;
}
