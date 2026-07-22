import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersonaStore } from '../store/personaStore';
import { usePersonaStream } from './usePersonaStream';
import { stripEmoji } from '../services/personaStyle';
import {
  createRecognizer,
  getVoiceSupport,
  guessGender,
  loadVoices,
  pickVoice,
  speak,
  speakSegments,
  type Recognizer,
  type Speaking,
} from '../services/voice/webSpeech';
import { toSpeechSegments, toSpokenText } from '../services/voice/hinglish';
import type { PersonaVoice } from '../services/persona';

// Turn-based, hands-free call loop:
//   listening → (you pause) → thinking (Ollama) → speaking → listening …
// The recognizer is stopped the whole time Ananya speaks so it never
// transcribes her own voice back in (echo).
export type CallState = 'idle' | 'listening' | 'thinking' | 'speaking';

const DEFAULT_VOICE: PersonaVoice = {
  lang: 'hi-IN',
  rate: 1,
  pitch: 1,
  transliterate: true,
  hindiLang: 'hi-IN',
  englishLang: 'en-IN',
  gender: 'female', // Ananya — keep one consistent gender across both voices
};
const REOPEN_DELAY_MS = 300; // small guard before reopening the mic after she speaks
const HAS_SPEECH = /[\p{L}\p{N}]/u; // don't bother speaking pure punctuation like "…"

export function useVoiceCall() {
  const persona = usePersonaStore((s) => s.persona);
  const { send } = usePersonaStream();

  const [callState, setCallState] = useState<CallState>('idle');
  const [interim, setInterim] = useState('');
  const [lastUserText, setLastUserText] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognizerRef = useRef<Recognizer | null>(null);
  const speakingRef = useRef<Speaking | null>(null);
  const activeRef = useRef(false); // is a call in progress
  const busyRef = useRef(false); // mid-turn (thinking/speaking) — mic must stay off
  const mutedRef = useRef(false);
  const voicesRef = useRef<{ hi: SpeechSynthesisVoice | null; en: SpeechSynthesisVoice | null }>({
    hi: null,
    en: null,
  });
  // True only when a real Hindi voice is installed; otherwise feeding Devanagari to
  // a non-Hindi voice would be worse than today, so we skip transliteration.
  const canCodeSwitchRef = useRef(false);

  // Latest voice prefs, read via ref so the loop never uses a stale closure.
  const prefsRef = useRef<PersonaVoice>(DEFAULT_VOICE);
  prefsRef.current = { ...DEFAULT_VOICE, ...(persona?.voice ?? {}) };

  const reopenMic = useCallback(() => {
    if (!activeRef.current || busyRef.current || mutedRef.current) return;
    setCallState('listening');
    setInterim('');
    recognizerRef.current?.start();
  }, []);

  // A settled utterance: send it to Ananya, then speak her reply. Kept in a ref
  // so the recognizer (created once per call) always calls the latest version.
  const handleFinal = async (transcript: string) => {
    const text = transcript.trim();
    if (!text || busyRef.current || !activeRef.current) return;

    busyRef.current = true;
    recognizerRef.current?.stop();
    setLastUserText(text);
    setInterim('');
    setCallState('thinking');

    try {
      const reply = await send(text);
      if (!activeRef.current) return;

      const spoken = stripEmoji(reply ?? '').trim(); // never read emoji aloud
      if (spoken && HAS_SPEECH.test(spoken)) {
        setLastReply(reply.trim());
        setCallState('speaking');
        const prefs = prefsRef.current;
        const { hi, en } = voicesRef.current;
        const transliterated = !!prefs.transliterate && canCodeSwitchRef.current;
        let s: Speaking;
        if (transliterated && hi && en && hi !== en) {
          // Two DISTINCT per-language voices → code-switch for the most accurate
          // pronunciation of each language (accepts a small pause at each switch).
          s = speakSegments(toSpeechSegments(spoken), prefs, { hi, en });
        } else {
          // One voice for the whole reply → speak each sentence as a SINGLE utterance
          // (not fragmented per word/language) so the engine keeps natural sentence
          // intonation and pauses. Still convert Hindi → Devanagari when possible.
          const text = transliterated ? toSpokenText(spoken) : spoken;
          s = speak(text, prefs, hi ?? en);
        }
        speakingRef.current = s;
        await s.promise;
        speakingRef.current = null;
      }
    } catch (e) {
      if (activeRef.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      if (activeRef.current) setTimeout(reopenMic, REOPEN_DELAY_MS);
    }
  };
  const handleFinalRef = useRef(handleFinal);
  handleFinalRef.current = handleFinal;

  const startCall = useCallback(() => {
    if (activeRef.current) return;
    if (!getVoiceSupport().stt) {
      setError('Voice input is not supported in this browser.');
      return;
    }

    activeRef.current = true;
    busyRef.current = false;
    mutedRef.current = false;
    setMuted(false);
    setError(null);
    setInterim('');
    setLastUserText('');
    setLastReply('');

    // Resolve one voice per language now (also nudges the async voice list to load).
    // voiceNameHint is bypassed for per-lang selection — it short-circuits pickVoice
    // before the lang check, which would collapse both picks to the same voice.
    void loadVoices().then((voices) => {
      const prefs = prefsRef.current;
      const hi = pickVoice(voices, { ...prefs, voiceNameHint: undefined, lang: prefs.hindiLang });
      let en = pickVoice(voices, { ...prefs, voiceNameHint: undefined, lang: prefs.englishLang });
      // Keep the persona one gender: if the only English voice is the opposite
      // gender from the (female) Hindi voice, reuse the Hindi voice for English too
      // (Indian-accented English, but no jarring mid-sentence gender switch).
      if (
        prefs.gender &&
        prefs.gender !== 'any' &&
        en &&
        guessGender(en) !== prefs.gender &&
        hi &&
        guessGender(hi) === prefs.gender
      ) {
        en = hi;
      }
      voicesRef.current = { hi, en };
      canCodeSwitchRef.current = !!hi && hi.lang.toLowerCase().startsWith('hi');
    });

    const rec = createRecognizer(prefsRef.current.lang || 'hi-IN', {
      onInterim: (t) => setInterim(t),
      onFinal: (t) => void handleFinalRef.current(t),
      onError: (err) => {
        // 'no-speech'/'aborted' are benign (silence/normal stop) — onEnd re-arms.
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setError('Microphone permission is blocked.');
          activeRef.current = false;
          setCallState('idle');
        }
      },
      onEnd: () => reopenMic(), // recognition timed out on silence — listen again
    });

    if (!rec) {
      setError('Voice input is not supported in this browser.');
      activeRef.current = false;
      return;
    }
    recognizerRef.current = rec;
    setCallState('listening');
    rec.start();
  }, [reopenMic]);

  const endCall = useCallback(() => {
    activeRef.current = false;
    busyRef.current = false;
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    speakingRef.current?.cancel();
    speakingRef.current = null;
    setCallState('idle');
    setInterim('');
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (next) {
        recognizerRef.current?.stop();
        setInterim('');
      } else if (activeRef.current && !busyRef.current) {
        setCallState('listening');
        recognizerRef.current?.start();
      }
      return next;
    });
  }, []);

  // Tear everything down if the component unmounts mid-call.
  useEffect(
    () => () => {
      activeRef.current = false;
      recognizerRef.current?.abort();
      speakingRef.current?.cancel();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* noop */
      }
    },
    []
  );

  return { callState, interim, lastUserText, lastReply, muted, error, startCall, endCall, toggleMute };
}
