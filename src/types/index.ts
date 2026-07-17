// A tool the assistant invoked while producing a message. Stored on the
// message so the tool activity stays visible and survives a reload.
export interface ToolInvocation {
  name: string;
  arguments: Record<string, unknown>;
  result?: string; // undefined while the tool is still running
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // base64-encoded, no data URI prefix
  toolCalls?: ToolInvocation[];
  thinking?: string; // reasoning trace, populated only when reasoning is enabled
  error?: string; // stream failure shown inline under the message
}

// Ollama's token counts from the last completed response. `atMessageCount`
// records messages.length at the time, so the counts are known to cover
// exactly that prefix of the conversation (messages are append-only).
export interface TokenStats {
  promptEvalCount: number;
  evalCount: number;
  atMessageCount: number;
}

// Rolling summary checkpoint: `text` summarizes messages[0, upToIndex). On
// send, history replays from the checkpoint with the summary injected into
// the system message; the next compaction folds this summary into a new one.
export interface ContextSummary {
  upToIndex: number;
  text: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created: number;
  reasoning?: boolean; // per-chat reasoning setting (defaults off)
  titleGenerated?: boolean; // an LLM-summarized title has been set (never re-title)
  lastTokenStats?: TokenStats;
  contextSummary?: ContextSummary;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type Theme = 'dark' | 'light';

// --- Ollama tool-calling types ---
// These describe the request/response wire format for /api/chat with tools.
// Kept separate from the UI `Message` type above, which only ever holds
// user/assistant text that is rendered and persisted.

export interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaChatChunk {
  message?: { content?: string; thinking?: string; tool_calls?: OllamaToolCall[] };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

// Events emitted by the tool-calling orchestrator to the streaming hook.
// `reset` clears any content accumulated so far (used at each tool round so
// intermediate rounds never leak into the visible answer).
export type ToolStreamEvent =
  | { type: 'delta'; value: string }
  | { type: 'reset' }
  | { type: 'thinking'; value: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'stats'; promptEvalCount: number; evalCount: number };
