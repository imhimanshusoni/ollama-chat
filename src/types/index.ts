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
