import { streamChatRaw } from './ollama';
import type {
  Message,
  OllamaMessage,
  OllamaTool,
  OllamaToolCall,
  ToolStreamEvent,
} from '../types';

// ---------------------------------------------------------------------------
// Tool definitions (JSON schema, Ollama /api/chat format).
// To add a new tool: append a definition here and register its implementation
// in `implementations` below.
// ---------------------------------------------------------------------------

export const tools: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description:
        "Get the user's current local date and time. Use this whenever the user asks what time or date it is.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for up-to-date information about a topic, person, place, or fact. Returns a short text summary of the top result.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query, e.g. "Eiffel Tower height".',
          },
        },
        required: ['query'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations (real, executed in the browser).
// ---------------------------------------------------------------------------

function getCurrentTime(): string {
  return new Date().toString();
}

interface DDGTopic {
  Text?: string;
  FirstURL?: string;
  Topics?: DDGTopic[];
}

interface DDGResponse {
  Answer?: string;
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Definition?: string;
  DefinitionSource?: string;
  DefinitionURL?: string;
  Heading?: string;
  RelatedTopics?: DDGTopic[];
}

// Flatten DuckDuckGo's RelatedTopics: some entries are groups holding a nested
// `Topics[]` array rather than a directly-usable `.Text`.
function flattenTopics(topics: DDGTopic[]): DDGTopic[] {
  const out: DDGTopic[] = [];
  for (const t of topics) {
    if (t.Topics && t.Topics.length) {
      out.push(...flattenTopics(t.Topics));
    } else if (t.Text) {
      out.push(t);
    }
  }
  return out;
}

async function webSearch(
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<string> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) return 'Error: web_search requires a non-empty "query" string.';

  const url =
    'https://api.duckduckgo.com/?q=' +
    encodeURIComponent(query) +
    '&format=json&no_html=1&skip_disambig=1';

  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data: DDGResponse = await resp.json();

  const parts: string[] = [];

  if (data.Answer) parts.push(data.Answer);

  if (data.AbstractText) {
    const src = data.AbstractSource ? ` (source: ${data.AbstractSource})` : '';
    parts.push(data.AbstractText + src);
  }

  if (data.Definition) {
    const src = data.DefinitionSource ? ` (source: ${data.DefinitionSource})` : '';
    parts.push(data.Definition + src);
  }

  if (data.RelatedTopics && data.RelatedTopics.length) {
    const related = flattenTopics(data.RelatedTopics)
      .slice(0, 3)
      .map((t) => (t.FirstURL ? `${t.Text} — ${t.FirstURL}` : t.Text))
      .filter(Boolean);
    if (related.length) parts.push('Related:\n' + related.join('\n'));
  }

  if (parts.length === 0) {
    return `No instant answer found for "${query}".`;
  }

  const summary = parts.join('\n\n');
  return summary.length > 800 ? summary.slice(0, 800) + '…' : summary;
}

// ---------------------------------------------------------------------------
// Dispatcher.
// ---------------------------------------------------------------------------

const implementations: Record<
  string,
  (args: Record<string, unknown>, signal?: AbortSignal) => string | Promise<string>
> = {
  get_current_time: () => getCurrentTime(),
  web_search: (args, signal) => webSearch(args, signal),
};

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<string> {
  const impl = implementations[name];
  if (!impl) {
    console.warn('[tools] unknown tool called:', name);
    return `Error: unknown tool "${name}"`;
  }

  // Defensive: the Ollama contract delivers parsed args, but guard against a
  // model/runtime that returns a JSON string instead.
  let safeArgs: Record<string, unknown> = args;
  if (typeof args === 'string') {
    try {
      safeArgs = JSON.parse(args);
    } catch {
      return `Error: could not parse arguments for tool "${name}"`;
    }
  }

  try {
    return await impl(safeArgs, signal);
  } catch (err) {
    if (isAbortError(err)) throw err; // let aborts cancel the whole loop
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[tools] tool threw:', name, message);
    return `Error: ${message}`;
  }
}

// ---------------------------------------------------------------------------
// Orchestrator: runs the tool-calling loop and yields a structured event
// stream. Content deltas from the FINAL round reach the UI; intermediate tool
// rounds are cleared by a `reset` emitted at the top of each round. Intermediate
// assistant(tool_calls) / tool messages live only in the local `working` array
// (never persisted), so they stay hidden from the chat UI.
// ---------------------------------------------------------------------------

const MAX_TOOL_ITERATIONS = 5;

// Models whose template rejects tools; remember them so we skip the tools
// attempt on subsequent sends within this session.
const toolUnsupportedModels = new Set<string>();

function toOllamaMessage(m: Message): OllamaMessage {
  return {
    role: m.role,
    content: m.content,
    ...(m.images ? { images: m.images } : {}),
  };
}

export async function* streamChatWithTools(
  baseUrl: string,
  model: string,
  messages: Message[],
  think: boolean,
  signal: AbortSignal
): AsyncGenerator<ToolStreamEvent> {
  const working: OllamaMessage[] = messages.map(toOllamaMessage);
  let toolsDisabled = toolUnsupportedModels.has(model);

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    if (signal.aborted) return;
    yield { type: 'reset' };

    const activeTools = toolsDisabled ? [] : tools;
    let content = '';
    const toolCalls: OllamaToolCall[] = [];
    let receivedChunk = false;
    // Token counts arrive on the round's done chunk, but whether the round is
    // final is only known afterwards (no tool_calls) — buffer, emit at return.
    let stats: { promptEvalCount: number; evalCount: number } | null = null;

    try {
      for await (const chunk of streamChatRaw(baseUrl, model, working, activeTools, think, signal)) {
        receivedChunk = true;
        if (chunk.thinking) {
          yield { type: 'thinking', value: chunk.thinking };
        }
        if (chunk.content) {
          content += chunk.content;
          yield { type: 'delta', value: chunk.content };
        }
        if (chunk.toolCalls && chunk.toolCalls.length) {
          toolCalls.push(...chunk.toolCalls);
        }
        if (chunk.done && chunk.promptEvalCount !== undefined && chunk.evalCount !== undefined) {
          stats = { promptEvalCount: chunk.promptEvalCount, evalCount: chunk.evalCount };
        }
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      // Only treat this as "the model rejects tools" when the server rejected
      // the request UP FRONT with an HTTP error (e.g. 400 — the model's template
      // lacks tool support). A mid-stream drop or network blip is NOT a tools
      // problem: disabling tools for the whole session on a transient failure
      // would silently leave the model with no tools until a reload (it would
      // then insist it can't call any tools). streamChatRaw throws
      // `HTTP <status>` before yielding anything on a non-OK response.
      const httpRejection = err instanceof Error && err.message.startsWith('HTTP');
      if (iter === 0 && activeTools.length > 0 && !receivedChunk && httpRejection) {
        console.warn('[tools] server rejected tools, retrying without them:', model, (err as Error).message);
        toolUnsupportedModels.add(model);
        toolsDisabled = true;
        iter = -1; // loop will ++ back to 0
        continue;
      }
      throw err;
    }

    working.push({
      role: 'assistant',
      content,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    });

    // No tool calls → this was the final answer (already streamed live).
    if (toolCalls.length === 0) {
      if (stats) yield { type: 'stats', ...stats };
      return;
    }

    console.log('[tools] tool_calls:', toolCalls);
    for (const call of toolCalls) {
      yield { type: 'tool_call', name: call.function.name, arguments: call.function.arguments };
      const result = await executeToolCall(call.function.name, call.function.arguments, signal);
      console.log('[tools] result:', call.function.name, result);
      yield { type: 'tool_result', name: call.function.name, result };
      working.push({ role: 'tool', tool_name: call.function.name, content: result });
    }
  }

  // Hit the iteration cap — force a final, tool-less text answer.
  if (signal.aborted) return;
  console.warn('[tools] hit MAX_TOOL_ITERATIONS, forcing a final answer');
  yield { type: 'reset' };
  for await (const chunk of streamChatRaw(baseUrl, model, working, [], think, signal)) {
    if (chunk.thinking) yield { type: 'thinking', value: chunk.thinking };
    if (chunk.content) yield { type: 'delta', value: chunk.content };
    if (chunk.done && chunk.promptEvalCount !== undefined && chunk.evalCount !== undefined) {
      yield { type: 'stats', promptEvalCount: chunk.promptEvalCount, evalCount: chunk.evalCount };
    }
  }
}
