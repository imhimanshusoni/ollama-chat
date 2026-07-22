// Retrieval-backed asana knowledge base. A curated library of yoga asanas
// (problem → recommended asana → steps → benefits → contraindications) is hosted
// on GitHub and embedded once into IndexedDB; per message we retrieve the most
// relevant entries and inject them into the persona's system prompt as grounded
// facts — so the persona recommends only real asanas from the library rather than
// inventing them. This is the "protocol" layer: it grounds WHAT she recommends,
// while personaExamples.ts grounds HOW she talks.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { embedPrefix, embedTexts } from './ollama';
import { normalizeVector } from './vectorStore';

export interface AsanaEntry {
  id: string;
  name: string; // e.g. "Bhujangasana (Cobra Pose)"
  problems: string; // what it helps with — the main retrieval signal
  steps: string; // plain, spoken-friendly how-to (no markdown)
  benefits: string;
  contraindications: string; // when to avoid / be careful
}

interface StoredAsana extends AsanaEntry {
  embedding: Float32Array;
}

interface AsanaDB extends DBSchema {
  asanas: { key: string; value: StoredAsana };
  meta: { key: string; value: { key: string; hash: string } };
}

const DB_NAME = 'ollama-asana';
const DB_VERSION = 1;
const EMBED_BATCH = 48;

const ASANAS_RAW_URL =
  'https://raw.githubusercontent.com/imhimanshusoni/ollama-chat/main/config/asanas.json';

let dbPromise: Promise<IDBPDatabase<AsanaDB>> | null = null;
function getDb(): Promise<IDBPDatabase<AsanaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AsanaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('asanas', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// In-memory cache of the current bank, so retrieval doesn't hit IndexedDB per
// message. Keyed by the bank hash so an edit to asanas.json invalidates it.
let bank: StoredAsana[] = [];
let bankHash: string | null = null;

// Module-level memoized fetch of the curated library. There is no store holding
// asanas (unlike persona.examples), so this module owns them; both the hook and
// the PersonaChat pre-warm share this one promise instead of re-fetching.
let asanasPromise: Promise<AsanaEntry[]> | null = null;

// Defensive validation of one untrusted remote entry. Requires the fields that
// make an asana usable/groundable; missing optional text becomes ''.
function sanitizeEntry(v: unknown): AsanaEntry | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim()) return null;
  if (typeof o.name !== 'string' || !o.name.trim()) return null;
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  return {
    id: o.id,
    name: o.name,
    problems: str(o.problems),
    steps: str(o.steps),
    benefits: str(o.benefits),
    contraindications: str(o.contraindications),
  };
}

// Fetch the curated asana library from GitHub raw (cache-busted, no-store),
// mirroring fetchPersona. Memoized so repeated callers share one request.
// Returns [] on any failure — callers degrade to the persona's general prompt.
export function fetchAsanas(): Promise<AsanaEntry[]> {
  if (!asanasPromise) {
    asanasPromise = (async () => {
      try {
        const resp = await fetch(`${ASANAS_RAW_URL}?t=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        });
        if (!resp.ok) return [];
        const data = (await resp.json()) as { asanas?: unknown };
        if (!Array.isArray(data.asanas)) return [];
        return data.asanas.map(sanitizeEntry).filter((e): e is AsanaEntry => e !== null);
      } catch {
        asanasPromise = null; // allow a later retry after a transient failure
        return [];
      }
    })();
  }
  return asanasPromise;
}

// The text embedded per entry — the fields a user's problem would match against.
function embedText(e: AsanaEntry): string {
  return `${e.name}\n${e.problems}\n${e.benefits}`;
}

// Small stable string hash (djb2) — identifies a bank version. Includes the
// embed model, so switching models forces a re-embed (vectors from different
// models aren't comparable).
function hashEntries(entries: AsanaEntry[], embedModel: string): string {
  const s = embedModel + '|' + JSON.stringify(entries);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

// Dedupe concurrent syncs of the same bank (open-effect + first send) so we
// don't re-embed the whole bank twice on a single-slot server.
let syncInFlight: { hash: string; promise: Promise<void> } | null = null;

export function isBankReady(): boolean {
  return bank.length > 0;
}

/**
 * Ensure the asana library is embedded and loaded into memory. Cheap no-op if
 * already synced this session. Reuses stored embeddings across reloads (keyed by
 * a hash of the entries + embed model), only re-embedding when the library or
 * model changes. Requires an embedding model on the server; callers should gate.
 */
export async function syncAsanaBank(
  entries: AsanaEntry[],
  baseUrl: string,
  embedModel: string
): Promise<void> {
  const hash = hashEntries(entries, embedModel);
  if (bankHash === hash && bank.length > 0) return; // already current in memory
  if (syncInFlight && syncInFlight.hash === hash) return syncInFlight.promise; // in progress

  const promise = doSyncAsanaBank(entries, hash, baseUrl, embedModel).finally(() => {
    if (syncInFlight?.hash === hash) syncInFlight = null;
  });
  syncInFlight = { hash, promise };
  return promise;
}

async function doSyncAsanaBank(
  entries: AsanaEntry[],
  hash: string,
  baseUrl: string,
  embedModel: string
): Promise<void> {
  if (entries.length === 0) {
    bank = [];
    bankHash = hash;
    return;
  }

  const db = await getDb();
  const storedHash = (await db.get('meta', 'bank'))?.hash;
  if (storedHash === hash) {
    // Embeddings already persisted for this exact bank — just load them.
    bank = await db.getAll('asanas');
    bankHash = hash;
    if (bank.length > 0) return;
  }

  // Re-embed the whole bank (library or embed model changed, or first run).
  const docPrefix = embedPrefix(embedModel, 'document');
  const records: StoredAsana[] = [];
  for (let i = 0; i < entries.length; i += EMBED_BATCH) {
    const batch = entries.slice(i, i + EMBED_BATCH);
    const vectors = await embedTexts(baseUrl, embedModel, batch.map((e) => docPrefix + embedText(e)));
    batch.forEach((e, j) => {
      records.push({ ...e, embedding: normalizeVector(vectors[j]) });
    });
  }

  const tx = db.transaction(['asanas', 'meta'], 'readwrite');
  await tx.objectStore('asanas').clear();
  for (const r of records) await tx.objectStore('asanas').put(r);
  await tx.objectStore('meta').put({ key: 'bank', hash });
  await tx.done;

  bank = records;
  bankHash = hash;
}

/**
 * Top-k asana entries most relevant to the current user message, by cosine
 * similarity (embeddings are normalized). Returns [] if the bank isn't ready or
 * embedding fails — the caller then relies on the persona's general knowledge.
 */
export async function retrieveAsanas(
  query: string,
  baseUrl: string,
  embedModel: string,
  k: number,
  signal?: AbortSignal
): Promise<AsanaEntry[]> {
  if (bank.length === 0 || !query.trim()) return [];
  try {
    const [vec] = await embedTexts(baseUrl, embedModel, [embedPrefix(embedModel, 'query') + query], signal);
    if (!vec) return [];
    const q = normalizeVector(vec);
    const dim = q.length;
    const scored = bank
      .filter((e) => e.embedding.length === dim)
      .map((e) => {
        let s = 0;
        for (let i = 0; i < dim; i++) s += e.embedding[i] * q[i];
        return { entry: e, score: s };
      });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => {
      const { embedding, ...entry } = s.entry;
      void embedding;
      return entry;
    });
  } catch {
    return [];
  }
}

/**
 * Render retrieved entries into the plain-text grounding block injected into the
 * persona's system prompt. Empty string when there's nothing to inject.
 */
export function asanaKnowledgeBlock(entries: AsanaEntry[]): string {
  if (entries.length === 0) return '';
  const lines = entries.map((e) => {
    const parts = [`- ${e.name}`];
    if (e.problems) parts.push(`  helps with: ${e.problems}`);
    if (e.steps) parts.push(`  how to do it: ${e.steps}`);
    if (e.benefits) parts.push(`  benefits: ${e.benefits}`);
    if (e.contraindications) parts.push(`  caution: ${e.contraindications}`);
    return parts.join('\n');
  });
  return (
    '\n\nRelevant asanas from your knowledge base for this person. ' +
    'Recommend ONLY from these; use their real steps and ALWAYS mention the caution when relevant. ' +
    'If none of these fit, say you are not sure rather than inventing an asana:\n' +
    lines.join('\n')
  );
}
