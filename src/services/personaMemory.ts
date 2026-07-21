import { generateOnce } from './ollama';
import type { Message } from '../types';

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

  const prompt =
    "You keep a short private memory of the person you (a friend) are texting with. " +
    "Update the memory with any new, lasting facts about THEM — their name, work, life, " +
    "feelings, plans, preferences, and your shared history. Keep only durable facts, drop small talk. " +
    "Reply with the full updated memory as a few short plain lines (max ~8), nothing else.\n\n" +
    `Existing memory:\n${existingMemory || '(none yet)'}\n\n` +
    `Recent conversation:\n${transcript}\n\nUpdated memory:`;

  try {
    const { content } = await generateOnce(
      baseUrl,
      model,
      [{ role: 'user', content: prompt }],
      { numPredict: 220, signal }
    );
    return content.trim() || existingMemory;
  } catch {
    return existingMemory;
  }
}
