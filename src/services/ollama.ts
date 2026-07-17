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

// Context window. Ollama's default (~4096) is quickly exhausted by a long
// conversation: the prompt fills the window, leaving almost no room to
// generate, so replies stop early with done_reason "length" (mid-sentence
// cut-offs). Raising this gives long chats room for both history and answer.
// gemma supports far larger; 8192 is a safe balance against Colab VRAM.
export const NUM_CTX = 8192;

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
      // Match streamChatRaw's num_ctx so warm-up loads the model at the same
      // context size — otherwise the first real message changes num_ctx and
      // forces a reload, defeating the warm-up.
      body: JSON.stringify({ model, messages: [], keep_alive: KEEP_ALIVE, options: { num_ctx: NUM_CTX } }),
    });
  } catch {
    // ignore — warm-up is best-effort
  }
}

/**
 * One-shot, non-streaming /api/chat call for background meta tasks (title
 * generation, history summarization). Sends the same keep_alive and num_ctx as
 * the chat requests — a different num_ctx would force Ollama to reload the
 * model (see warmModel). Never includes tools and never thinks.
 */
export async function generateOnce(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  opts?: { numPredict?: number; signal?: AbortSignal }
): Promise<{ content: string; promptEvalCount?: number; evalCount?: number }> {
  const resp = await fetch(baseUrl + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      think: false,
      keep_alive: KEEP_ALIVE,
      options: {
        num_ctx: NUM_CTX,
        ...(opts?.numPredict ? { num_predict: opts.numPredict } : {}),
      },
    }),
    signal: opts?.signal,
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data: OllamaChatChunk = await resp.json();
  return {
    content: data.message?.content ?? '',
    promptEvalCount: data.prompt_eval_count,
    evalCount: data.eval_count,
  };
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
  think: boolean,
  signal: AbortSignal
): AsyncGenerator<{
  content?: string;
  thinking?: string;
  toolCalls?: OllamaToolCall[];
  done?: boolean;
  doneReason?: string;
  promptEvalCount?: number;
  evalCount?: number;
}> {
  const resp = await fetch(baseUrl + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: KEEP_ALIVE,
      options: { num_ctx: NUM_CTX },
      // gemma-style reasoning models emit their chain-of-thought under
      // message.thinking. Explicitly opt out unless the user enabled it, so
      // the token budget goes to the actual answer.
      think,
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
    const thinking = j.message?.thinking;
    const toolCalls = j.message?.tool_calls;
    if (content || thinking || (toolCalls && toolCalls.length) || j.done) {
      yield {
        content,
        thinking,
        toolCalls,
        done: j.done,
        doneReason: j.done_reason,
        promptEvalCount: j.prompt_eval_count,
        evalCount: j.eval_count,
      };
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
