// Thin, framework-agnostic wrapper over the browser-native Web Speech API.
// Output (TTS) uses SpeechSynthesis with an Indian voice so Ananya's romanized
// Hinglish is pronounced correctly; input (STT) uses SpeechRecognition, whose
// end-of-speech detection gives us free VAD (voice activity detection).
// No servers, no downloads, no dependencies.

import type { PersonaVoice } from '../persona';
import type { SpeechSegment } from './hinglish';

const DEFAULT_LANG = 'hi-IN';
const DEFAULT_RATE = 1;
const DEFAULT_PITCH = 1;

export interface VoiceSupport {
  stt: boolean; // speech recognition (mic → text)
  tts: boolean; // speech synthesis (text → voice)
}

export function getVoiceSupport(): VoiceSupport {
  if (typeof window === 'undefined') return { stt: false, tts: false };
  const stt = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const tts = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
  return { stt, tts };
}

// --- Recognition (STT) -----------------------------------------------------

export interface RecognizerCallbacks {
  onInterim?: (text: string) => void; // live partial transcript
  onFinal?: (text: string) => void; // settled utterance after the user pauses
  onError?: (error: string) => void; // e.g. 'no-speech', 'not-allowed'
  onEnd?: () => void; // recognition session ended (pause/timeout)
}

export interface Recognizer {
  start: () => void;
  stop: () => void; // graceful — still emits any pending final result
  abort: () => void; // immediate — drops pending results
}

export function createRecognizer(lang: string, cb: RecognizerCallbacks): Recognizer | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = lang || DEFAULT_LANG;
  rec.interimResults = true;
  // continuous:false → the engine emits a final result once the user stops
  // talking, which is exactly the turn boundary a turn-based call needs.
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = (ev) => {
    let interim = '';
    let final = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      const txt = res[0]?.transcript ?? '';
      if (res.isFinal) final += txt;
      else interim += txt;
    }
    const trimmedInterim = interim.trim();
    const trimmedFinal = final.trim();
    if (trimmedInterim) cb.onInterim?.(trimmedInterim);
    if (trimmedFinal) cb.onFinal?.(trimmedFinal);
  };
  rec.onerror = (ev) => cb.onError?.(ev.error);
  rec.onend = () => cb.onEnd?.();

  return {
    start: () => {
      try {
        rec.start();
      } catch {
        // start() throws if it's already running — safe to ignore.
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    },
  };
}

// --- Synthesis (TTS) -------------------------------------------------------

// getVoices() is populated asynchronously on some browsers; resolve once it is,
// with a timeout fallback in case the 'voiceschanged' event never fires.
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return resolve([]);
    const existing = synth.getVoices();
    if (existing.length) return resolve(existing);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener?.('voiceschanged', finish, { once: true });
    setTimeout(finish, 1200);
  });
}

// The Web Speech API exposes no gender field, so guess from the voice name. Lists
// cover common macOS / Windows / Chrome-Google / Azure Indian + English voices.
const FEMALE_NAMES = [
  'female', 'woman', 'lekha', 'veena', 'kanya', 'swara', 'aditi', 'raveena',
  'neerja', 'heera', 'kalpana', 'samantha', 'victoria', 'karen', 'moira',
  'tessa', 'fiona', 'serena', 'allison', 'ava', 'susan', 'zira', 'alice',
  'anna', 'ellen', 'nora', 'paulina', 'sara', 'monica', 'kate', 'joanna',
  'salli', 'kimberly', 'aria', 'jenny', 'michelle',
];
const MALE_NAMES = [
  'rishi', 'ravi', 'hemant', 'madhur', 'prabhat', 'david', 'mark', 'alex',
  'daniel', 'fred', 'oliver', 'thomas', 'george', 'james', 'aaron', 'arthur',
  'gordon', 'guy', 'matthew', 'brian', 'ryan', 'eric',
];

export function guessGender(voice: SpeechSynthesisVoice): 'female' | 'male' | 'unknown' {
  const n = voice.name.toLowerCase();
  if (/\bfemale\b/.test(n) || FEMALE_NAMES.some((x) => n.includes(x))) return 'female';
  if (/\bmale\b/.test(n) || MALE_NAMES.some((x) => n.includes(x))) return 'male';
  return 'unknown';
}

// Prefer the wanted gender, then unknown, and only fall back to the opposite
// gender if nothing else matches (so the persona keeps one consistent voice).
function genderScore(voice: SpeechSynthesisVoice, wanted: 'female' | 'male' | 'any'): number {
  if (wanted === 'any') return 0;
  const g = guessGender(voice);
  if (g === wanted) return 2;
  if (g === 'unknown') return 1;
  return 0;
}

// Choose the best voice for the persona: an explicit name hint wins; otherwise
// prefer the configured language (default hi-IN), then Indian English, then any
// English — and within each language tier prefer the persona's gender.
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  prefs: PersonaVoice
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const hint = prefs.voiceNameHint?.toLowerCase();
  if (hint) {
    const byName = voices.find((v) => v.name.toLowerCase().includes(hint));
    if (byName) return byName;
  }

  const wanted = prefs.gender ?? 'any';
  const bestOf = (cands: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!cands.length) return null;
    if (wanted === 'any') return cands[0];
    return [...cands].sort((a, b) => genderScore(b, wanted) - genderScore(a, wanted))[0];
  };

  const lang = (prefs.lang || DEFAULT_LANG).toLowerCase();
  const exact = bestOf(voices.filter((v) => v.lang.toLowerCase() === lang));
  if (exact) return exact;

  for (const pref of [lang, 'en-in', 'en']) {
    const tier = bestOf(voices.filter((v) => v.lang.toLowerCase().startsWith(pref)));
    if (tier) return tier;
  }
  return voices[0];
}

export interface Speaking {
  promise: Promise<void>; // resolves when the whole text has been spoken (or cancelled)
  cancel: () => void;
}

// Split into sentence-ish chunks (Latin punctuation + the Hindi danda/newline)
// so playback is smoother and avoids the long-utterance cutoff seen on iOS.
const SENTENCE_RE = /[^.!?…।\n]+[.!?…।\n]*/g;

function chunkText(text: string): string[] {
  const matches = text.match(SENTENCE_RE);
  return (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
}

export function speak(
  text: string,
  prefs: PersonaVoice,
  voice: SpeechSynthesisVoice | null
): Speaking {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const chunks = chunkText(text);
  if (!synth || !chunks.length) {
    return { promise: Promise.resolve(), cancel: () => {} };
  }

  let cancelled = false;
  const promise = new Promise<void>((resolve) => {
    let i = 0;
    const next = () => {
      if (cancelled || i >= chunks.length) {
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || prefs.lang || DEFAULT_LANG;
      u.rate = prefs.rate ?? DEFAULT_RATE;
      u.pitch = prefs.pitch ?? DEFAULT_PITCH;
      u.onend = () => next();
      u.onerror = () => next(); // don't stall the queue on a single failed chunk
      synth.speak(u);
    };
    next();
  });

  const cancel = () => {
    cancelled = true;
    try {
      synth.cancel();
    } catch {
      /* noop */
    }
  };

  return { promise, cancel };
}

// Code-switching variant: speak a sequence of language-tagged segments, each with
// its own voice/lang, in order. Hindi runs (Devanagari) get the hi voice, English
// runs (Latin) get the en voice — so neither engine is handed a script it can't
// read. Reuses the same sequential queue/onend pattern as speak().
export function speakSegments(
  segments: SpeechSegment[],
  prefs: PersonaVoice,
  voices: { hi: SpeechSynthesisVoice | null; en: SpeechSynthesisVoice | null }
): Speaking {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

  // Flatten segments → per-chunk utterance specs, preserving each chunk's voice/lang.
  const specs: { text: string; voice: SpeechSynthesisVoice | null; lang: string }[] = [];
  for (const seg of segments) {
    const voice = seg.lang === 'hi' ? voices.hi : voices.en;
    const fallbackLang =
      seg.lang === 'hi' ? prefs.hindiLang || 'hi-IN' : prefs.englishLang || 'en-IN';
    for (const chunk of chunkText(seg.text)) {
      specs.push({ text: chunk, voice, lang: voice?.lang || fallbackLang });
    }
  }
  if (!synth || !specs.length) {
    return { promise: Promise.resolve(), cancel: () => {} };
  }

  let cancelled = false;
  const promise = new Promise<void>((resolve) => {
    let i = 0;
    const next = () => {
      if (cancelled || i >= specs.length) {
        resolve();
        return;
      }
      const spec = specs[i++];
      const u = new SpeechSynthesisUtterance(spec.text);
      if (spec.voice) u.voice = spec.voice;
      u.lang = spec.lang;
      u.rate = prefs.rate ?? DEFAULT_RATE;
      u.pitch = prefs.pitch ?? DEFAULT_PITCH;
      u.onend = () => next();
      u.onerror = () => next();
      synth.speak(u);
    };
    next();
  });

  const cancel = () => {
    cancelled = true;
    try {
      synth.cancel();
    } catch {
      /* noop */
    }
  };

  return { promise, cancel };
}
