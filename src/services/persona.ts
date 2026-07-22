import type { OllamaMessage } from '../types';

// Persona definition for the "chat like a real person" space. Hosted on GitHub
// (like config/model-url.txt) so the voice, character, and few-shot examples can
// be tuned without redeploying the app.
// Optional voice settings for the spoken-call feature (Web Speech synthesis).
// All fields optional — sensible defaults are applied where absent.
export interface PersonaVoice {
  lang?: string; // BCP-47 tag, e.g. 'hi-IN' or 'en-IN' (single-voice fallback)
  voiceNameHint?: string; // substring to match a specific installed voice by name
  rate?: number; // 0.1–10, default 1
  pitch?: number; // 0–2, default 1
  transliterate?: boolean; // convert romanized Hindi → Devanagari before speaking (default true)
  hindiLang?: string; // voice language for Hindi (Devanagari) runs, default 'hi-IN'
  englishLang?: string; // voice language for English runs, default 'en-IN'
  gender?: 'female' | 'male' | 'any'; // preferred voice gender, default 'female' (Ananya)
}

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
  // Optional voice settings for the spoken-call feature.
  voice?: PersonaVoice;
}

// fetchPersona rebuilds the object from an explicit literal, so a new field must
// be passed through here or it's silently dropped. Guard the shape defensively
// since this is untrusted remote JSON.
function sanitizeVoice(v: unknown): PersonaVoice | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: PersonaVoice = {};
  if (typeof o.lang === 'string') out.lang = o.lang;
  if (typeof o.voiceNameHint === 'string') out.voiceNameHint = o.voiceNameHint;
  if (typeof o.rate === 'number') out.rate = o.rate;
  if (typeof o.pitch === 'number') out.pitch = o.pitch;
  if (typeof o.transliterate === 'boolean') out.transliterate = o.transliterate;
  if (typeof o.hindiLang === 'string') out.hindiLang = o.hindiLang;
  if (typeof o.englishLang === 'string') out.englishLang = o.englishLang;
  if (o.gender === 'female' || o.gender === 'male' || o.gender === 'any') out.gender = o.gender;
  return Object.keys(out).length ? out : undefined;
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
      voice: sanitizeVoice(data.voice),
    };
  } catch {
    return null;
  }
}
