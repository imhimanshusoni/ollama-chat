import { generateOnce } from './ollama';
import type { Message } from '../types';

// Is this a real memory worth using/injecting (not empty, a dash, or an echoed
// "(none yet)" placeholder)?
export function isMeaningfulMemory(m: string | undefined | null): boolean {
  const t = (m ?? '').trim();
  return t.length > 0 && t !== '-' && !/^\(?\s*none/i.test(t);
}

// Maintains a short, durable memory of the person the persona is texting with,
// so the chat feels continuous across sessions (it remembers your name, life,
// how you've been). Runs in the background after a reply via the non-streaming
// meta path; on any failure the previous memory is kept.
export async function updatePersonaMemory(
  baseUrl: string,
  model: string,
  existingMemory: string,
  recentTurns: Message[],
  signal?: AbortSignal
): Promise<string> {
  const transcript = recentTurns
    .filter((m) => m.content)
    .map((m) => `${m.role === 'user' ? 'Them' : 'You'}: ${m.content}`)
    .join('\n');
  if (!transcript) return existingMemory;
  const prior = isMeaningfulMemory(existingMemory) ? existingMemory : '';

  const prompt =
    "You maintain a short private memory about the person a friend is texting with. " +
    "From the conversation below, extract durable facts about THEM — name, work, life, feelings, " +
    "plans, upcoming events, preferences, and shared history — and merge them with what's already known. " +
    "Output ONLY the updated memory as a few short plain factual lines (max ~8). " +
    "No preamble, no placeholders, no quotes. If there is genuinely nothing worth remembering, output a single dash '-'.\n\n" +
    (prior ? `Already known:\n${prior}\n\n` : '') +
    `Conversation:\n${transcript}\n\nUpdated memory:`;

  try {
    const { content } = await generateOnce(
      baseUrl,
      model,
      [{ role: 'user', content: prompt }],
      { numPredict: 220, signal }
    );
    const out = content.trim();
    // Guard against an empty/echoed/placeholder answer — keep (cleaned) prior.
    if (!isMeaningfulMemory(out)) return prior;
    return out;
  } catch {
    return prior;
  }
}
