// Persona style control — fixes "model uses an emoji, apologizes, then redrafts"
// and enforces style directives deterministically.
//
// Design note (post-review): detection is deliberately narrow. Self-correction
// cleanup only triggers on EMOJI-specific cues (not bare "sorry"/"wait"), so a
// normal casual reply like "I wanted to come (sorry I missed it) how was it?"
// is never mangled. Emoji enforcement and redraft dedup are the guarantees.

export interface PersonaStyle {
  emoji: boolean;
}

export const DEFAULT_STYLE: PersonaStyle = { emoji: true };

// --- L1: detect a style directive in a user message -----------------------

export function detectStyleDirective(text: string): Partial<PersonaStyle> | null {
  const t = text.toLowerCase();
  if (!/emoji|emoticon/.test(t)) return null;

  // Don't turn emojis off if the message is positive about them.
  const positive = /\b(love|like|great|nice|cute|good|awesome|keep|more|zyada)\b/.test(t);

  // Primary signal: negation/positive adjacent to "emoji", not a bag of words.
  const off =
    /\b(no|without|stop|dont|don'?t|avoid|bina)\b[\w\s]{0,10}emoji/.test(t) ||
    /emoji\w*[\w\s]{0,10}\b(band|mat|nahi|stop|off|kam|hata|nahi chahiye)\b/.test(t) ||
    /without emoji/.test(t);
  const on =
    /\b(use|add|chahiye|wapas)\b[\w\s]{0,10}emoji/.test(t) ||
    /emoji\w*[\w\s]{0,10}\b(chalega|theek|ok|fine|allowed|kar sakti|use kar)\b/.test(t);

  if (on) return { emoji: true };
  if (off && !positive) return { emoji: false };
  return null;
}

// --- Emoji stripping -------------------------------------------------------

// Emoji, ZWJ sequences, skin-tone modifiers, variation selectors, keycaps, and
// regional-indicator flag pairs.
const EMOJI_RE =
  /(?:\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*|[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F3FB}-\u{1F3FF}]|[⃣️‍])/gu;

// Strip emoji, replacing with a space so adjacent words don't merge
// ("haan😄chalo" → "haan chalo"), then tidy spacing.
export function stripEmoji(text: string): string {
  return text
    .replace(EMOJI_RE, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,!?…])/g, '$1')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

// --- L3: clean a buffered reply -------------------------------------------

// Cues that identify an EMOJI self-correction specifically (not generic apology).
const CORRECTION =
  'no\\s*emoji|without emoji|emoji[\\w\\s]{0,20}(aa gaya|phir se|use kiya|hata|nikaal)|phir se[\\w\\s]{0,20}(emoji|aa gaya)|let me try (again|properly|once more)|try (again|properly)|abhi toh maine use kiya|control nahi|ab nahi (aayega|karungi|karunga)|meri galti';
const CORRECTION_PAREN = new RegExp(`\\(([^)]*(?:${CORRECTION})[^)]*)\\)`, 'gi');
const CORRECTION_LINE = new RegExp(`^\\s*\\(?\\s*(?:oops|arre sorry|sorry)?[\\s,.]*(?:${CORRECTION})`, 'i');

const MIN_DEDUP_LEN = 15; // only dedupe substantial segments

function normKey(s: string): string {
  return stripEmoji(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function cleanPersonaReply(text: string, style: PersonaStyle): string {
  let t = text.replace(/\r/g, '').trim();

  // 1) Emoji self-correction in parens → keep only the redraft after the last one.
  const parens = [...t.matchAll(CORRECTION_PAREN)];
  if (parens.length) {
    const last = parens[parens.length - 1];
    const tail = t.slice((last.index ?? 0) + last[0].length).trim();
    if (tail.length >= 3) t = tail;
  }

  // 2) Remove any remaining emoji self-correction parentheticals.
  t = t.replace(CORRECTION_PAREN, '').trim();

  // 3) Drop short standalone emoji self-correction note lines.
  let segs = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !(CORRECTION_LINE.test(s) && s.length < 80));

  // 4) Dedupe only substantial near-identical segments (the draft/redraft pair),
  //    keeping the LAST — short lines and emoji-only lines are never collapsed.
  const keyed = segs.map((s) => ({ s, k: normKey(s) }));
  const lastIdx = new Map<string, number>();
  keyed.forEach((o, i) => {
    if (o.k.length >= MIN_DEDUP_LEN) lastIdx.set(o.k, i);
  });
  segs = keyed.filter((o, i) => o.k.length < MIN_DEDUP_LEN || lastIdx.get(o.k) === i).map((o) => o.s);

  t = segs.join('\n').trim();

  // 5) Enforce the emoji preference deterministically.
  if (!style.emoji) t = stripEmoji(t);

  return t || (style.emoji ? text.trim() : stripEmoji(text.trim()));
}

// L2 helper: strip emoji from few-shot examples so they stop contradicting an
// active "no emoji" preference.
export function applyStyleToExamples<T extends { content: string }>(
  examples: T[],
  style: PersonaStyle
): T[] {
  if (style.emoji) return examples;
  return examples.map((m) => ({ ...m, content: stripEmoji(m.content) }));
}
