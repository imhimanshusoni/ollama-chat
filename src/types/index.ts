export interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // base64-encoded, no data URI prefix
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created: number;
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
  role: 'user' | 'assistant' | 'tool';
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
  message?: { content?: string; tool_calls?: OllamaToolCall[] };
  done?: boolean;
}

// Events emitted by the tool-calling orchestrator to the streaming hook.
// `reset` clears any content accumulated so far (used at each tool round so
// intermediate rounds never leak into the visible answer).
export type ToolStreamEvent =
  | { type: 'delta'; value: string }
  | { type: 'reset' };
