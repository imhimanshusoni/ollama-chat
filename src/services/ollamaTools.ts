import { streamChatRaw } from './ollama';
import { buildSystemPrompt } from './prompts';
import { isSearchConfigured, searchWeb } from './webSearch';
import { TOOL_RESULT_CAP } from '../utils/tokenEstimate';
import type {
  Message,
  OllamaMessage,
  OllamaTool,
  OllamaToolCall,
  ToolInvocation,
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
        'Search the web for current or factual information: news, prices, weather, events, products, releases, technical questions, or anything that may postdate your training data. Returns the top results as titles, URLs and content snippets. Use ONE broad keyword-style query (e.g. "HP 24f monitor specs"), not a full sentence. Never repeat a query that already returned no results.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Broad keyword-style search query, e.g. "iPhone 16 pro price india".',
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

// ---------------------------------------------------------------------------
// Dispatcher.
// ---------------------------------------------------------------------------

// Runtime context threaded from the chat hook down to tool implementations.
export interface ToolContext {
  signal?: AbortSignal;
}

const implementations: Record<
  string,
  (args: Record<string, unknown>, ctx: ToolContext) => string | Promise<string>
> = {
  get_current_time: () => getCurrentTime(),
  web_search: (args, ctx) => {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) return 'Error: web_search requires a non-empty "query" string.';
    return searchWeb(query, ctx.signal);
  },
};

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
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
    return await impl(safeArgs, ctx);
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

// How many recent tool-bearing assistant turns are replayed in full
// (tool_calls + tool results). Older ones collapse to a one-line note so the
// model stays aware it already searched without paying the token cost.
const FULL_TOOL_TURNS = 2;

// A cancelled call must not read as a failed search — the system prompt tells
// the model never to repeat a query that returned nothing, so "(no result)"
// would steer it away from ever re-searching the user's question.
const CANCELLED_RESULT =
  '(the user cancelled this call before it finished — run it again if still relevant)';

function collapseToolTurn(m: Message, calls: ToolInvocation[]): OllamaMessage {
  const notes = calls
    .map((c) => `[Earlier, used ${c.name}(${JSON.stringify(c.arguments)})]`)
    .join(' ');
  return { role: 'assistant', content: `${notes}\n${m.content}`.trim() };
}

/**
 * Rebuilds the wire-format history from persisted messages. Previously tool
 * rounds lived only in the transient `working` array, so on the next turn the
 * model had no record it ever called a tool (and would deny having searched).
 * A persisted assistant message with toolCalls now expands back into the
 * assistant(tool_calls) → tool → assistant(text) sequence Ollama expects.
 *
 * `plainText` renders tool turns as bracketed notes inside assistant content
 * instead — for models whose template rejects tool_calls/tool messages.
 */
export function buildOllamaHistory(
  messages: Message[],
  opts?: { plainText?: boolean }
): OllamaMessage[] {
  const toolTurnIndices = messages
    .map((m, i) => (m.role === 'assistant' && m.toolCalls?.length ? i : -1))
    .filter((i) => i !== -1);
  const expandSet = new Set(toolTurnIndices.slice(-FULL_TOOL_TURNS));

  const out: OllamaMessage[] = [];
  messages.forEach((m, i) => {
    const calls = m.role === 'assistant' ? m.toolCalls : undefined;
    if (!calls || calls.length === 0) {
      // Never replay an empty assistant turn (e.g. aborted mid-thinking) —
      // blank prior answers confuse small models' chat templates.
      if (m.role === 'assistant' && !m.content) return;
      out.push(toOllamaMessage(m));
      return;
    }
    // A fully cancelled round (no results, no text) carries no information.
    if (!m.content && calls.every((c) => c.result === undefined)) return;
    if (opts?.plainText || !expandSet.has(i)) {
      out.push(collapseToolTurn(m, calls));
      return;
    }
    out.push({
      role: 'assistant',
      content: '',
      tool_calls: calls.map((c) => ({ function: { name: c.name, arguments: c.arguments } })),
    });
    for (const c of calls) {
      const result = c.result ?? CANCELLED_RESULT;
      out.push({
        role: 'tool',
        tool_name: c.name,
        content: result.length > TOOL_RESULT_CAP ? result.slice(0, TOOL_RESULT_CAP) + '…' : result,
      });
    }
    if (m.content) out.push({ role: 'assistant', content: m.content });
  });
  return out;
}

export async function* streamChatWithTools(
  baseUrl: string,
  model: string,
  messages: Message[],
  think: boolean | string,
  signal: AbortSignal,
  opts?: { contextSummary?: string }
): AsyncGenerator<ToolStreamEvent> {
  const toolCtx: ToolContext = { signal };
  let toolsDisabled = toolUnsupportedModels.has(model);
  // Without a configured search key, web_search can only fail — don't offer
  // it, and don't let the system prompt encourage it.
  const searchAvailable = isSearchConfigured();
  const availableTools = searchAvailable
    ? tools
    : tools.filter((t) => t.function.name !== 'web_search');
  const systemMessage = (toolsEnabled: boolean): OllamaMessage => ({
    role: 'system',
    content:
      buildSystemPrompt('', toolsEnabled, searchAvailable) +
      (opts?.contextSummary
        ? `\n\nSummary of the earlier conversation (for your memory):\n${opts.contextSummary}`
        : ''),
  });
  const buildWorking = (plainText: boolean): OllamaMessage[] => [
    systemMessage(!plainText),
    ...buildOllamaHistory(messages, { plainText }),
  ];
  let working: OllamaMessage[] = buildWorking(toolsDisabled);

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    if (signal.aborted) return;
    yield { type: 'reset' };

    const activeTools = toolsDisabled ? [] : availableTools;
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
        // Rebuild the whole request: the system message must not promise
        // tools, and replayed tool_calls/tool messages must flatten to plain
        // text — a template that rejects tools can reject those shapes too.
        // Safe to rebuild wholesale: this branch only runs on iter 0, before
        // anything streamed.
        working = buildWorking(true);
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
      const result = await executeToolCall(call.function.name, call.function.arguments, toolCtx);
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
