// Persona style control — the fix for "model uses an emoji, apologizes, then
// redrafts" and similar constraint-violation artifacts.
//
// Root cause: the emoji-heavy few-shot examples contradict a "no emoji"
// instruction, so the model wavers and its self-correction leaks into the reply.
// Fix in three layers:
//   L1 — detect style directives → structured state (this file + personaStore)
//   L2 — make conditioning consistent (strip emoji from injected examples) so
//        the examples stop contradicting the instruction (usePersonaStream)
//   L3 — deterministically clean the buffered reply (cleanPersonaReply): drop
//        self-correction meta-notes, collapse redrafts, enforce emoji-off.

export interface PersonaStyle {
  emoji: boolean;
}

export const DEFAULT_STYLE: PersonaStyle = { emoji: true };

// --- L1: detect a style directive in a user message -----------------------

export function detectStyleDirective(text: string): Partial<PersonaStyle> | null {
  const t = text.toLowerCase();
  const mentionsEmoji = /emoji|emojis|emoticon/.test(t);
  if (mentionsEmoji) {
    const off = /\b(no|without|stop|dont|don't|avoid|band|mat|nahi|off)\b/.test(t) || /without emoji/.test(t);
    const on = /\b(use|add|chalega|theek|ok|fine|allowed|kar sakti|kar sakte)\b/.test(t);
    if (off && !on) return { emoji: false };
    if (on && !off) return { emoji: true };
    // "no emoji" phrased as adjacency, e.g. "emoji band kar"
    if (/emoji.{0,12}(band|mat|nahi|stop|off)/.test(t)) return { emoji: false };
    if (/(band|mat|nahi|stop|no|without).{0,12}emoji/.test(t)) return { emoji: false };
  }
  return null;
}

// --- Emoji stripping -------------------------------------------------------

// Matches emoji, ZWJ sequences, skin-tone modifiers, variation selectors,
// keycaps, and regional-indicator flag pairs.
const EMOJI_RE =
  /(?:\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*|[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F3FB}-\u{1F3FF}]|[⃣️‍])/gu;

export function stripEmoji(text: string): string {
  return text
    .replace(EMOJI_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,!?…])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

// --- L3: clean a buffered reply -------------------------------------------

// Markers that identify the model's self-correction meta-commentary.
const META =
  "wait|oops|sorry|no\\s*emoji|without\\s*emoji|phir se|let me try|try properly|habit hai|control nahi|galti|aa gaya|ab nahi (aayega|karungi|karunga)";
const META_PAREN = new RegExp(`\\(([^)]*(?:${META})[^)]*)\\)`, 'gi');
// A standalone line that is essentially just an emoji self-correction note.
const META_NOTE_SRC =
  'no\\s*emoji|without\\s*emoji|let me try|try properly|emoji .*aa gaya|phir se .*aa gaya|control nahi|ab nahi (?:aayega|karungi|karunga)';
const META_NOTE = new RegExp(`^\\s*\\(?\\s*(?:${META_NOTE_SRC})`, 'i');

function normKey(s: string): string {
  return stripEmoji(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Deterministically clean a full (buffered) persona reply so self-correction
 * artifacts never reach the UI. Handles the exact bug: "<draft 😂> (wait… let
 * me try properly) <clean redraft>" → keeps only the clean redraft.
 */
export function cleanPersonaReply(text: string, style: PersonaStyle): string {
  let t = text.replace(/\r/g, '').trim();

  // 1) If the model self-corrected, its final intended message is whatever
  //    comes AFTER the last meta-note. Keep that, drop the flawed draft + note.
  const parens = [...t.matchAll(META_PAREN)];
  if (parens.length) {
    const last = parens[parens.length - 1];
    const tail = t.slice((last.index ?? 0) + last[0].length).trim();
    if (tail.length >= 3) t = tail;
  }

  // 2) Remove any remaining inline meta-parentheticals.
  t = t.replace(META_PAREN, '').trim();

  // 3) Segment cleanup: drop standalone meta-note lines, then dedupe repeated
  //    segments keeping the LAST (the model's final redraft).
  let segs = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !(META_NOTE.test(s) && s.length < 80));
  const lastIdx = new Map<string, number>();
  segs.forEach((s, i) => lastIdx.set(normKey(s), i));
  segs = segs.filter((s, i) => lastIdx.get(normKey(s)) === i);
  t = segs.join('\n').trim();

  // 4) Enforce the emoji preference deterministically (the hard guarantee).
  if (!style.emoji) t = stripEmoji(t);

  return t || stripEmoji(text.trim());
}

// L2 helper: strip emoji from the few-shot examples so they stop contradicting
// an active "no emoji" preference.
export function applyStyleToExamples<T extends { content: string }>(
  examples: T[],
  style: PersonaStyle
): T[] {
  if (style.emoji) return examples;
  return examples.map((m) => ({ ...m, content: stripEmoji(m.content) }));
}
