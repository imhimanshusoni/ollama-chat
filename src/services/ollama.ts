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
// cut-offs). gemma4 supports up to 256K, and its sliding-window attention
// (1024-token SWA on the 31B) keeps the KV cache small, so a large window is
// cheap on VRAM. 32768 is a good balance for a ~24GB+ GPU; raise/lower to taste.
export const NUM_CTX = 32768;

// gemma4's recommended sampling (per the model card). Applied only to gemma4
// variants on the chat path — other models keep their own defaults, and the
// deterministic meta calls (title/summary) are left untouched.
export function isGemma4(model: string): boolean {
  return model.startsWith('gemma4');
}
const GEMMA4_SAMPLING = { temperature: 1.0, top_p: 0.95, top_k: 64 };

// A stale trycloudflare.com hostname can resolve but never respond, hanging a
// fetch forever. Bound how long we wait to establish a connection; streaming
// bodies are exempt (the timeout covers connection + headers only).
export const CONNECT_TIMEOUT_MS = 10_000;

// Non-streaming meta calls (title, summary) only resolve after generation
// finishes, which can be slow on Colab/Kaggle GPUs — bound them loosely, just
// enough to reclaim a truly wedged connection.
const META_TIMEOUT_MS = 120_000;

// Ollama holds the /api/chat response headers until the first token is ready,
// so a cold model (load + prompt eval on a Kaggle/Colab GPU) can legitimately
// take minutes before any byte arrives. This is only a backstop against a
// black-holed tunnel — the user can always hit Stop sooner.
const STREAM_FIRST_BYTE_TIMEOUT_MS = 180_000;

export async function fetchModels(baseUrl: string): Promise<string[]> {
  const resp = await fetch(baseUrl + '/api/tags', {
    signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return (data.models || []).map((m: { name: string }) => m.name);
}

// ---------------------------------------------------------------------------
// Embeddings (RAG "Chat with your Documents").
// ---------------------------------------------------------------------------

// Default embedding model. 768-dim, ~274MB — small enough to sit beside the
// pinned chat model in VRAM. The user pulls it on the remote Ollama with
// `ollama pull nomic-embed-text`.
export const DEFAULT_EMBED_MODEL = 'nomic-embed-text';

// Thrown when /api/embed reports the embedding model isn't installed. The UI
// catches this to show an actionable "ollama pull" instruction instead of a
// generic failure.
export class EmbedModelMissingError extends Error {
  model: string;
  constructor(model: string) {
    super(`Embedding model "${model}" is not installed on the Ollama server.`);
    this.name = 'EmbedModelMissingError';
    this.model = model;
  }
}

// Does the connected server (its /api/tags list) have the embedding model?
// Ollama tags carry a `:tag` suffix (e.g. "nomic-embed-text:latest"), so match
// on the base name. Used for the up-front UI gate — no extra network call.
export function hasEmbedModel(models: string[], embedModel = DEFAULT_EMBED_MODEL): boolean {
  const base = embedModel.split(':')[0];
  return models.some((m) => m === embedModel || m.split(':')[0] === base);
}

// nomic-embed-text is trained with task-instruction prefixes and its retrieval
// quality drops noticeably without them: documents must be embedded with
// "search_document: " and queries with "search_query: ". Applied only for
// nomic models — other embedding models get the raw text. A query and its
// documents must use the same model (and thus the same prefixing) to be
// comparable; RagDocument.embedModel records which model embedded each doc.
export function embedPrefix(model: string, kind: 'query' | 'document'): string {
  if (!model.split(':')[0].startsWith('nomic-embed-text')) return '';
  return kind === 'query' ? 'search_query: ' : 'search_document: ';
}

/**
 * Embed a batch of texts via Ollama's current /api/embed endpoint (NOT the
 * legacy singular /api/embeddings). Returns one vector per input, in order.
 *
 * `truncate: true` lets Ollama clip an over-long chunk to the model's context
 * rather than failing the whole batch. A cold embed model pays a load cost like
 * chat does, so this uses the loose meta timeout, not the connect one.
 */
export async function embedTexts(
  baseUrl: string,
  model: string,
  input: string[],
  signal?: AbortSignal
): Promise<number[][]> {
  if (input.length === 0) return [];

  // A network-level failure propagates as-is, so the caller can distinguish it
  // from EmbedModelMissingError (which is only thrown on an explicit 404).
  const resp = await fetch(baseUrl + '/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, keep_alive: KEEP_ALIVE, truncate: true }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(META_TIMEOUT_MS)])
      : AbortSignal.timeout(META_TIMEOUT_MS),
  });

  if (!resp.ok) {
    // Ollama returns 404 with a body like {"error":"model '...' not found"}
    // when the model isn't pulled. Detect it so the UI can guide the user.
    let bodyText = '';
    try {
      bodyText = await resp.text();
    } catch {
      // ignore — fall through to the generic error
    }
    if (resp.status === 404 || /not found/i.test(bodyText)) {
      throw new EmbedModelMissingError(model);
    }
    throw new Error('HTTP ' + resp.status);
  }

  const data: { embeddings?: number[][] } = await resp.json();
  const embeddings = data.embeddings ?? [];
  if (embeddings.length !== input.length) {
    throw new Error(
      `Embedding count mismatch: expected ${input.length}, got ${embeddings.length}`
    );
  }
  return embeddings;
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
      // The response only arrives once the model finishes loading — give it
      // the loose meta bound, not the connect one, so the keep_alive pin lands.
      body: JSON.stringify({ model, messages: [], keep_alive: KEEP_ALIVE, options: { num_ctx: NUM_CTX } }),
      signal: AbortSignal.timeout(META_TIMEOUT_MS),
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
    // TimeoutError (unlike a user abort's AbortError) surfaces as an error to
    // the caller — keep that distinction.
    signal: opts?.signal
      ? AbortSignal.any([opts.signal, AbortSignal.timeout(META_TIMEOUT_MS)])
      : AbortSignal.timeout(META_TIMEOUT_MS),
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
  think: boolean | string,
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
  // Bound the wait for the first byte only — once the stream is open, reads
  // are governed solely by the caller's signal.
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(
    () => timeoutCtrl.abort(new DOMException('Connection timed out', 'TimeoutError')),
    STREAM_FIRST_BYTE_TIMEOUT_MS
  );

  let resp: Response;
  try {
    resp = await fetch(baseUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        keep_alive: KEEP_ALIVE,
        options: { num_ctx: NUM_CTX, ...(isGemma4(model) ? GEMMA4_SAMPLING : {}) },
        // gemma-style reasoning models emit their chain-of-thought under
        // message.thinking. Explicitly opt out unless the user enabled it, so
        // the token budget goes to the actual answer.
        think,
        ...(tools.length ? { tools } : {}),
      }),
      signal: AbortSignal.any([signal, timeoutCtrl.signal]),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  if (!resp.body) throw new Error('Empty response body');
  const reader = resp.body.getReader();
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
      if (j.done && j.done_reason === 'length') {
        // The reply hit the context ceiling mid-generation. If this shows up,
        // raise OUTPUT_RESERVE in contextWindow.ts (currently 4096).
        console.warn('[ollama] response truncated: done_reason=length');
      }
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

  // finally releases the reader's lock even when the consumer exits the
  // generator early (break/return/throw), so the stream isn't left locked.
  try {
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
  } finally {
    reader.releaseLock();
  }
}
