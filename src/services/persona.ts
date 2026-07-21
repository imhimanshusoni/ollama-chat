import type { OllamaMessage } from '../types';

// Persona definition for the "chat like a real person" space. Hosted on GitHub
// (like config/model-url.txt) so the voice, character, and few-shot examples can
// be tuned without redeploying the app.
export interface Persona {
  name: string;
  avatar: string; // emoji or short label shown in the header/bubbles
  systemPrompt: string;
  // Curated example exchanges (alternating user/assistant) injected as few-shot
  // context so the model imitates the persona's real texting style — the part
  // that makes it feel human rather than a prompted assistant.
  examples: OllamaMessage[];
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
    };
  } catch {
    return null;
  }
}
