import type {
  OllamaChatChunk,
  OllamaMessage,
  OllamaTool,
  OllamaToolCall,
} from '../types';

// Keep the model resident in VRAM so Ollama doesn't unload it after its
// default ~5min idle — an unload forces a slow multi-second reload on the next
// message. -1 pins it loaded indefinitely. Sent on every chat request and on
// warm-up. Change to a duration (e.g. '30m') if you'd rather it free VRAM.
const KEEP_ALIVE = -1;

export async function fetchModels(baseUrl: string): Promise<string[]> {
  const resp = await fetch(baseUrl + '/api/tags');
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return (data.models || []).map((m: { name: string }) => m.name);
}

/**
 * Preload a model into memory (and pin it via keep_alive) so the first real
 * message doesn't pay the load cost. Ollama loads the model when `messages` is
 * empty. Best-effort and fire-and-forget — errors are swallowed.
 */
export async function warmModel(baseUrl: string, model: string): Promise<void> {
  if (!baseUrl || !model) return;
  try {
    await fetch(baseUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [], keep_alive: KEEP_ALIVE }),
    });
  } catch {
    // ignore — warm-up is best-effort
  }
}

/**
 * Low-level streaming reader for /api/chat. Parses the NDJSON stream and yields
 * structured chunks carrying content deltas and/or tool_calls. Pass an empty
 * `tools` array for a plain (tool-less) chat request — the field is omitted from
 * the body in that case.
 */
export async function* streamChatRaw(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  tools: OllamaTool[],
  signal: AbortSignal
): AsyncGenerator<{ content?: string; toolCalls?: OllamaToolCall[]; done?: boolean }> {
  const resp = await fetch(baseUrl + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: KEEP_ALIVE,
      ...(tools.length ? { tools } : {}),
    }),
    signal,
  });

  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const emit = function* (line: string) {
    if (!line.trim()) return;
    let j: OllamaChatChunk;
    try {
      j = JSON.parse(line);
    } catch {
      return; // skip malformed lines
    }
    const content = j.message?.content;
    const toolCalls = j.message?.tool_calls;
    if (content || (toolCalls && toolCalls.length) || j.done) {
      yield { content, toolCalls, done: j.done };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      yield* emit(line);
    }
  }

  if (buffer.trim()) {
    yield* emit(buffer);
  }
}
