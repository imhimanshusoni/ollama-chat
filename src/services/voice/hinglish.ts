// Romanized Hinglish → Devanagari, for the voice-call TTS path only (the visible
// chat text stays romanized). A browser `hi-IN` voice reads Devanagari with correct
// Hindi phonemes; feeding it raw Latin ("kyu bol re hai") makes it guess and sound
// off. We convert the Hindi words to Devanagari and keep genuine English words in
// Latin, then split into per-language runs so the caller can code-switch voices.
//
// Strategy (dictionary-first, since casual Hinglish spelling is too inconsistent for
// scheme-based transliterators like ITRANS):
//   1. English-word guard  → keep Latin (spoken by an en-IN voice)
//   2. curated Hindi dict   → hand-verified Devanagari for her real vocabulary
//   3. rule-based fallback  → greedy Latin→Devanagari for the long tail

export interface SpeechSegment {
  text: string;
  lang: 'hi' | 'en';
}

// --- 1. English-word guard -------------------------------------------------
// Words that are unambiguously English in her code-mixed speech. Deliberately does
// NOT include tokens that are also common Hindi words (main, so, na, tu…) — those
// belong to the Hindi dictionary. Lowercase; matched case-insensitively.
const ENGLISH_WORDS = new Set<string>([
  // function / very common
  'a', 'an', 'the', 'i', 'im', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
  'you', 'your', 'youre', 'yours', 'u', 'my', 'mine', 'me', 'we', 'our', 'they',
  'he', 'she', 'it', 'its', 'this', 'that', 'these', 'those', 'and', 'or', 'but',
  'of', 'for', 'to', 'in', 'on', 'at', 'with', 'from', 'by', 'as', 'if', 'so',
  'not', 'no', 'yes', 'yeah', 'yep', 'nope', 'ok', 'okay', 'okk', 'hi', 'hey',
  'heyy', 'hello', 'bye', 'oh', 'ooh', 'wow', 'hmm', 'well', 'just', 'only',
  'really', 'very', 'too', 'also', 'now', 'then', 'here', 'there', 'what', 'why',
  'how', 'when', 'where', 'who', 'which', 'can', 'will', 'would', 'should', 'do',
  'did', 'done', 'get', 'got', 'go', 'going', 'let', 'lets', 'have', 'has', 'had',
  // feelings / small talk
  'please', 'plz', 'sorry', 'thanks', 'thank', 'welcome', 'congrats',
  'congratulations', 'good', 'great', 'nice', 'cool', 'cute', 'sweet', 'lovely',
  'awesome', 'amazing', 'perfect', 'better', 'best', 'bad', 'worse', 'love',
  'like', 'miss', 'feeling', 'feel', 'happy', 'sad', 'tired', 'busy', 'free',
  'low', 'fine', 'sure', 'maybe', 'actually', 'literally', 'obviously',
  // internet / filler
  'lol', 'lmao', 'omg', 'haha', 'hahaha', 'hehe', 'ugh', 'yay', 'wooo', 'woah',
  'btw', 'idk', 'tbh', 'anyway',
  // her life vocabulary (from the persona)
  'work', 'office', 'meeting', 'deadline', 'deadlines', 'project', 'projects',
  'interview', 'product', 'designer', 'design', 'startup', 'job', 'promotion',
  'call', 'text', 'message', 'phone', 'reel', 'reels', 'video', 'movie', 'movies',
  'coffee', 'chai', 'cafe', 'party', 'plan', 'plans', 'weekend', 'break', 'trip',
  'rest', 'sleep', 'morning', 'today', 'tomorrow', 'tonight', 'day', 'days',
  'time', 'week', 'month', 'year', 'min', 'mins', 'minute', 'minutes', 'hour',
  'promise', 'mood', 'vibe', 'stress', 'killing', 'one', 'two', 'three',
  // broader common-English backstop (heuristic misses these: no c/x/q or suffix)
  'try', 'tried', 'trying', 'done', 'made', 'make', 'take', 'took', 'give',
  'gave', 'find', 'found', 'keep', 'kept', 'told', 'ask', 'asked', 'need',
  'want', 'wanted', 'know', 'knew', 'think', 'thought', 'said', 'say', 'saw',
  'seen', 'come', 'came', 'put', 'read', 'write', 'wrote', 'talk', 'talked',
  'meet', 'met', 'send', 'sent', 'show', 'shown', 'wait', 'waited', 'stop',
  'start', 'stay', 'stayed', 'move', 'live', 'lived', 'die', 'died', 'buy',
  'bought', 'pay', 'paid', 'lose', 'lost', 'win', 'won', 'run', 'ran',
  'filter', 'horror', 'page', 'treat', 'table', 'people', 'simple', 'subtle',
  'before', 'after', 'about', 'over', 'under', 'again', 'always', 'never',
  'maybe', 'probably', 'seriously', 'honestly', 'exactly', 'finally', 'already',
  'still', 'even', 'though', 'because', 'something', 'everything', 'nothing',
  'someone', 'anything', 'anyone', 'everyone', 'stuff', 'thing', 'things',
  'life', 'home', 'room', 'food', 'water', 'music', 'song', 'songs', 'series',
  'book', 'books', 'game', 'games', 'exam', 'exams', 'college', 'class',
  'boss', 'client', 'clients', 'email', 'emails', 'laptop', 'screen', 'app',
  'online', 'wifi', 'weather', 'rain', 'birthday', 'holiday', 'vacation',
  'dinner', 'lunch', 'breakfast', 'snack', 'restaurant', 'market', 'shopping',
  'dress', 'gym', 'workout', 'walk', 'drive', 'car', 'bus', 'train', 'flight',
  'ticket', 'money', 'bank', 'salary', 'budget', 'idea', 'ideas', 'problem',
  'issue', 'help', 'point', 'reason', 'story', 'photo', 'photos', 'pic',
  'pics', 'picture', 'selfie', 'guys', 'girl', 'boy', 'dude', 'gonna',
  'wanna', 'kinda', 'super', 'pretty', 'quite', 'enough', 'almost',
]);

// --- 2. Curated Hindi dictionary (romanized → Devanagari) ------------------
// Hand-verified. Built from Ananya's actual example bank plus common Hinglish.
const HINDI_DICT: Record<string, string> = {
  // pronouns / core
  main: 'मैं', mai: 'मैं', hum: 'हम', tu: 'तू', tum: 'तुम', aap: 'आप',
  mera: 'मेरा', meri: 'मेरी', mere: 'मेरे', tera: 'तेरा', teri: 'तेरी',
  tere: 'तेरे', tumhara: 'तुम्हारा', hamara: 'हमारा', mujhe: 'मुझे',
  tujhe: 'तुझे', mereko: 'मेरेको', tereko: 'तेरेको', mujhko: 'मुझको',
  yeh: 'ये', ye: 'ये', woh: 'वो', wo: 'वो', vo: 'वो', koi: 'कोई',
  kuch: 'कुछ', kuchh: 'कुछ', sab: 'सब', kaun: 'कौन', khud: 'ख़ुद',
  // verbs / be
  hai: 'है', hain: 'हैं', ho: 'हो', hu: 'हूँ', hoon: 'हूँ', tha: 'था',
  thi: 'थी', the: 'थे', the_: 'थे', hoga: 'होगा', hogi: 'होगी',
  hua: 'हुआ', hui: 'हुई', hue: 'हुए', kar: 'कर', karo: 'करो',
  karta: 'करता', karti: 'करती', karte: 'करते', karna: 'करना',
  karni: 'करनी', karke: 'करके', karungi: 'करूँगी', karunga: 'करूँगा',
  kiya: 'किया', ki: 'की', kia: 'किया', ja: 'जा', jaa: 'जा', jao: 'जाओ',
  jana: 'जाना', gaya: 'गया', gayi: 'गई', gaye: 'गए', gai: 'गई',
  aa: 'आ', aao: 'आओ', aana: 'आना', aaya: 'आया', aayi: 'आई', aate: 'आते',
  aata: 'आता', aati: 'आती', le: 'ले', lo: 'लो', liya: 'लिया', legi: 'लेगी',
  lega: 'लेगा', de: 'दे', do: 'दो', diya: 'दिया', bol: 'बोल', bola: 'बोला',
  boli: 'बोली', bolo: 'बोलो', bata: 'बता', batao: 'बताओ', batati: 'बताती',
  dekh: 'देख', dekho: 'देखो', dekha: 'देखा', sun: 'सुन', sunn: 'सुन',
  suno: 'सुनो', suna: 'सुना', so: 'सो', soja: 'सोजा', soyi: 'सोई',
  uth: 'उठ', utho: 'उठो', utha: 'उठा', ruk: 'रुक', ruko: 'रुको',
  chal: 'चल', chalo: 'चलो', chalega: 'चलेगा', chalta: 'चलता',
  raha: 'रहा', rahi: 'रही', rahe: 'रहे', rehna: 'रहना', rakh: 'रख',
  kha: 'खा', khana: 'खाना', khaya: 'खाया', pi: 'पी', piya: 'पिया',
  bana: 'बना', banti: 'बनती', banta: 'बनता', mil: 'मिल', mila: 'मिला',
  mili: 'मिली', hone: 'होने', chahiye: 'चाहिए', chahti: 'चाहती',
  chahta: 'चाहता', pata: 'पता', samajh: 'समझ', maar: 'मार', nikaal: 'निकाल',
  hata: 'हटा', bhej: 'भेज', pooch: 'पूछ', laga: 'लगा', lagi: 'लगी',
  lag: 'लग', lagta: 'लगता', lagti: 'लगती', mangta: 'मांगता',
  // question / connectors
  kya: 'क्या', kyu: 'क्यूँ', kyun: 'क्यों', kyunki: 'क्योंकि', kaise: 'कैसे',
  kaisi: 'कैसी', kaisa: 'कैसा', kaha: 'कहा', kahan: 'कहाँ', kab: 'कब',
  kitna: 'कितना', kitni: 'कितनी', kitne: 'कितने', jab: 'जब', tab: 'तब',
  agar: 'अगर', toh: 'तो', to: 'तो', phir: 'फिर', lekin: 'लेकिन', par: 'पर',
  magar: 'मगर', aur: 'और', ya: 'या', bhi: 'भी', hi: 'ही', na: 'ना',
  nahi: 'नहीं', nahin: 'नहीं', mat: 'मत', matlab: 'मतलब', yani: 'यानी',
  waise: 'वैसे', aise: 'ऐसे', jaise: 'जैसे', wahi: 'वही', yahi: 'यही',
  wahan: 'वहाँ', yahan: 'यहाँ', idhar: 'इधर', udhar: 'उधर',
  // time / place / nouns
  ab: 'अब', abhi: 'अभी', kabhi: 'कभी', hamesha: 'हमेशा', kal: 'कल',
  aaj: 'आज', subah: 'सुबह', raat: 'रात', shaam: 'शाम', din: 'दिन',
  waqt: 'वक़्त', der: 'देर', jaldi: 'जल्दी', ghar: 'घर', bahar: 'बाहर',
  andar: 'अंदर', paas: 'पास', door: 'दूर', ghum: 'घूम', kaam: 'काम',
  baat: 'बात', baatein: 'बातें', neend: 'नींद', chai: 'चाय', paani: 'पानी',
  khana_: 'खाना', dost: 'दोस्त', dil: 'दिल', pyaar: 'प्यार', pyar: 'प्यार',
  zindagi: 'ज़िंदगी', paisa: 'पैसा', haal: 'हाल', mood_: 'मूड',
  tension: 'टेंशन', gussa: 'गुस्सा', mann: 'मन', man: 'मन', tabiyat: 'तबियत',
  // adjectives / adverbs
  accha: 'अच्छा', acha: 'अच्छा', acchi: 'अच्छी', achha: 'अच्छा',
  bura: 'बुरा', theek: 'ठीक', thik: 'ठीक', sahi: 'सही', galat: 'ग़लत',
  bada: 'बड़ा', badi: 'बड़ी', chota: 'छोटा', choti: 'छोटी', naya: 'नया',
  nayi: 'नई', purana: 'पुराना', thoda: 'थोड़ा', thodi: 'थोड़ी',
  zyada: 'ज़्यादा', kam: 'कम', bahut: 'बहुत', bohot: 'बहुत', bohat: 'बहुत',
  itna: 'इतना', itni: 'इतनी', itne: 'इतने', puri: 'पूरी', pura: 'पूरा',
  sara: 'सारा', khush: 'ख़ुश', pareshan: 'परेशान', mast: 'मस्त',
  // particles / interjections
  arre: 'अरे', are: 'अरे', arey: 'अरे', haan: 'हाँ', han: 'हाँ',
  haa: 'हाँ', bas: 'बस', re: 'रे', yaar: 'यार', yr: 'यार', acha_: 'अच्छा',
  chhod: 'छोड़', chhodo: 'छोड़ो', chup: 'चुप', bina: 'बिना', band: 'बंद',
  wapas: 'वापस', se: 'से', pe: 'पे', par_: 'पर', tak: 'तक', ke: 'के',
  ka: 'का', ko: 'को', mein: 'में', me_: 'में',
};

// --- 3. Rule-based fallback ------------------------------------------------
// Greedy longest-match Latin→Devanagari for words not in the dict. 'a' is the
// inherent vowel (no matra); Hindi TTS engines apply schwa-deletion, so a bare
// consonant reads correctly at word end. Imperfect on the long tail by design.

// Consonants (longest keys first via sorted matching). Digraphs before singles.
const CONSONANTS: Record<string, string> = {
  chh: 'छ', ch: 'च', kh: 'ख', gh: 'घ', jh: 'झ', th: 'थ', dh: 'ध', ph: 'फ',
  bh: 'भ', sh: 'श', ng: 'ंग', ny: 'ंय',
  k: 'क', g: 'ग', j: 'ज', t: 'त', d: 'द', n: 'न', p: 'प', f: 'फ', b: 'ब',
  m: 'म', y: 'य', r: 'र', l: 'ल', v: 'व', w: 'व', s: 'स', h: 'ह', z: 'ज़',
  // safety-net mappings so a stray English-ish letter never leaks as raw Latin
  // into the Devanagari output (English words are caught earlier by looksEnglish).
  c: 'क', x: 'क्स', q: 'क़',
};
// Independent vowels (word start / after a vowel) and their matras (after consonant).
const VOWELS: Record<string, { indep: string; matra: string }> = {
  aa: { indep: 'आ', matra: 'ा' }, ai: { indep: 'ऐ', matra: 'ै' },
  au: { indep: 'औ', matra: 'ौ' }, ee: { indep: 'ई', matra: 'ी' },
  ii: { indep: 'ई', matra: 'ी' }, oo: { indep: 'ऊ', matra: 'ू' },
  uu: { indep: 'ऊ', matra: 'ू' },
  a: { indep: 'अ', matra: '' }, i: { indep: 'इ', matra: 'ि' },
  u: { indep: 'उ', matra: 'ु' }, e: { indep: 'ए', matra: 'े' },
  o: { indep: 'ओ', matra: 'ो' },
};
const CONS_KEYS = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length);
const VOWEL_KEYS = Object.keys(VOWELS).sort((a, b) => b.length - a.length);
const VIRAMA = '्';

function matchAt(word: string, i: number, keys: string[]): string | null {
  for (const k of keys) {
    if (word.startsWith(k, i)) return k;
  }
  return null;
}

export function transliterateWord(word: string): string {
  const w = word.toLowerCase();
  let out = '';
  let i = 0;
  let prevWasConsonant = false;
  while (i < w.length) {
    const c = matchAt(w, i, CONS_KEYS);
    if (c) {
      // A consonant directly following another consonant with no vowel → the
      // previous one takes a virama (half form / cluster).
      if (prevWasConsonant) out += VIRAMA;
      out += CONSONANTS[c];
      i += c.length;
      prevWasConsonant = true;
      continue;
    }
    const v = matchAt(w, i, VOWEL_KEYS);
    if (v) {
      out += prevWasConsonant ? VOWELS[v].matra : VOWELS[v].indep;
      i += v.length;
      prevWasConsonant = false;
      continue;
    }
    // Unknown character (digit, stray letter) — pass through, reset state.
    out += w[i];
    i += 1;
    prevWasConsonant = false;
  }
  return out;
}

// --- Word classification + segmentation ------------------------------------

function isEnglishWord(lower: string): boolean {
  return ENGLISH_WORDS.has(lower);
}

// High-recall heuristic for English words NOT in the guard list. Misclassifying is
// asymmetric: calling a word English just leaves it romanized (today's behaviour),
// whereas calling English "Hindi" yields garbage Devanagari — so we lean English on
// signals that are rare/absent in romanized Hindi.
const EN_SUFFIX = /(?:tion|sion|ment|ness|ful|less|able|ible|ance|ence|ically|ing|ly|ed)$/;
function looksEnglish(lower: string): boolean {
  if (lower.length < 3) return false;
  if (/[xq]/.test(lower)) return true; // x/q effectively don't occur in romanized Hindi
  if (/c/.test(lower.replace(/chh?/g, ''))) return true; // bare 'c' (not ch/chh) ⇒ English
  if (/(oa|oe|ue|augh|ough)/.test(lower)) return true; // English-only vowel clusters
  if (EN_SUFFIX.test(lower)) return true;
  return false;
}

// Convert one Latin word to { text, lang }. Non-Latin words (already Devanagari,
// digits, symbols) are returned unchanged as Hindi so they ride the hi-IN voice.
function classifyWord(word: string): { text: string; lang: 'hi' | 'en' } {
  const lower = word.toLowerCase();
  if (isEnglishWord(lower)) return { text: word, lang: 'en' };
  // Curated dict is authoritative Hindi and is checked before the heuristic so a
  // known Hindi word is never misread as English.
  if (Object.prototype.hasOwnProperty.call(HINDI_DICT, lower)) {
    return { text: HINDI_DICT[lower], lang: 'hi' };
  }
  if (looksEnglish(lower)) return { text: word, lang: 'en' };
  return { text: transliterateWord(word), lang: 'hi' };
}

const WORD_RE = /[A-Za-z]+/;

// Split text into contiguous same-language runs. Separators (spaces, punctuation,
// emoji, digits) attach to the run in progress so sentence punctuation is kept for
// the TTS chunker downstream.
export function toSpeechSegments(text: string): SpeechSegment[] {
  const tokens = text.split(/([A-Za-z]+)/).filter((t) => t.length > 0);
  const segments: SpeechSegment[] = [];

  const push = (chunk: string, lang: 'hi' | 'en') => {
    const last = segments[segments.length - 1];
    if (last && last.lang === lang) last.text += chunk;
    else segments.push({ text: chunk, lang });
  };

  for (const tok of tokens) {
    if (WORD_RE.test(tok)) {
      const { text: mapped, lang } = classifyWord(tok);
      push(mapped, lang);
    } else {
      // Separator: append to whatever run is current (default 'hi' if none yet).
      const lang = segments.length ? segments[segments.length - 1].lang : 'hi';
      push(tok, lang);
    }
  }
  return segments;
}

// Single-string convenience (used by the single-voice fallback path).
export function toSpokenText(text: string): string {
  return toSpeechSegments(text)
    .map((s) => s.text)
    .join('');
}
