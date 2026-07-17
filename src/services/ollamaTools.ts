import { streamChatRaw } from './ollama';
import { buildSystemPrompt } from './prompts';
import { searchWeb } from './webSearch';
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
  searchApiKey: string;
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
    return searchWeb(query, ctx.searchApiKey, ctx.signal);
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
const TOOL_RESULT_CAP = 1500;

/**
 * Rebuilds the wire-format history from persisted messages. Previously tool
 * rounds lived only in the transient `working` array, so on the next turn the
 * model had no record it ever called a tool (and would deny having searched).
 * A persisted assistant message with toolCalls now expands back into the
 * assistant(tool_calls) → tool → assistant(text) sequence Ollama expects.
 */
export function buildOllamaHistory(messages: Message[]): OllamaMessage[] {
  const toolTurnIndices = messages
    .map((m, i) => (m.role === 'assistant' && m.toolCalls?.length ? i : -1))
    .filter((i) => i !== -1);
  const expandSet = new Set(toolTurnIndices.slice(-FULL_TOOL_TURNS));

  const out: OllamaMessage[] = [];
  messages.forEach((m, i) => {
    const calls = m.role === 'assistant' ? m.toolCalls : undefined;
    if (!calls || calls.length === 0) {
      out.push(toOllamaMessage(m));
      return;
    }
    if (expandSet.has(i)) {
      out.push({
        role: 'assistant',
        content: '',
        tool_calls: calls.map((c) => ({ function: { name: c.name, arguments: c.arguments } })),
      });
      for (const c of calls) {
        const result = c.result ?? '(cancelled — no result)';
        out.push({
          role: 'tool',
          tool_name: c.name,
          content: result.length > TOOL_RESULT_CAP ? result.slice(0, TOOL_RESULT_CAP) + '…' : result,
        });
      }
      if (m.content) out.push({ role: 'assistant', content: m.content });
    } else {
      const notes = calls
        .map((c) => `[Earlier, used ${c.name}(${JSON.stringify(c.arguments)})]`)
        .join(' ');
      out.push({ role: 'assistant', content: `${notes}\n${m.content}`.trim() });
    }
  });
  return out;
}

export async function* streamChatWithTools(
  baseUrl: string,
  model: string,
  messages: Message[],
  think: boolean,
  signal: AbortSignal,
  opts?: { systemPromptOverride?: string; searchApiKey?: string; contextSummary?: string }
): AsyncGenerator<ToolStreamEvent> {
  const toolCtx: ToolContext = { searchApiKey: opts?.searchApiKey ?? '', signal };
  let toolsDisabled = toolUnsupportedModels.has(model);
  const systemMessage = (toolsEnabled: boolean): OllamaMessage => ({
    role: 'system',
    content:
      buildSystemPrompt(opts?.systemPromptOverride ?? '', toolsEnabled) +
      (opts?.contextSummary
        ? `\n\nSummary of the earlier conversation (for your memory):\n${opts.contextSummary}`
        : ''),
  });
  const working: OllamaMessage[] = [
    systemMessage(!toolsDisabled),
    ...buildOllamaHistory(messages),
  ];

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
        // Rebuild the system message so the retry doesn't promise tools it
        // no longer has.
        working[0] = systemMessage(false);
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
