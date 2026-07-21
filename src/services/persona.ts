import type { OllamaMessage } from '../types';

// Persona definition for the "chat like a real person" space. Hosted on GitHub
// (like config/model-url.txt) so the voice, character, and few-shot examples can
// be tuned without redeploying the app.
export interface Persona {
  name: string;
  avatar: string; // emoji or short label shown in the header/bubbles
  systemPrompt: string;
  // Example exchange bank (alternating user/assistant). Embedded and retrieved
  // per message (personaExamples.ts) so the persona can draw on a large set of
  // real examples rather than a few canned ones.
  examples: OllamaMessage[];
  // Whether the persona builds up long-term memory of the user across the chat.
  memoryEnabled: boolean;
}

const PERSONA_RAW_URL =
  'https://raw.githubusercontent.com/imhimanshusoni/ollama-chat/main/config/persona.json';

export async function fetchPersona(): Promise<Persona | null> {
  try {
    const resp = await fetch(`${PERSONA_RAW_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as Partial<Persona>;
    if (!data.name || !data.systemPrompt) return null;
    return {
      name: data.name,
      avatar: data.avatar || '🙂',
      systemPrompt: data.systemPrompt,
      examples: Array.isArray(data.examples) ? data.examples : [],
      memoryEnabled: data.memoryEnabled !== false, // default on
    };
  } catch {
    return null;
  }
}
