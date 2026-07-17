import { generateOnce } from './ollama';

// Prompt tuned for small local models (Open WebUI pattern): strict JSON output
// with few-shot examples, parsed leniently below since models still wrap the
// JSON in prose sometimes.
const TITLE_PROMPT = `### Task:
Generate a concise, 3-5 word title summarizing the conversation below.

### Guidelines:
- The title must clearly represent the main topic of the conversation.
- Use the conversation's primary language (default to English if multilingual).
- Do NOT use quotation marks, emojis, or the word "chat" in the title.
- Respond with ONLY a JSON object in the exact format below. No other text.

### Output format:
{"title": "your concise title here"}

### Examples:
{"title": "Stock Market Trends"}
{"title": "Perfect Chocolate Chip Recipe"}
{"title": "Remote Work Productivity Tips"}

### Conversation:
`;

const SLICE = 200;

/**
 * One-shot background call that summarizes the first exchange into a short
 * chat title. Returns null on any failure — the caller keeps the existing
 * truncated-first-message fallback title in that case.
 */
export async function generateChatTitle(
  baseUrl: string,
  model: string,
  userMsg: string,
  assistantMsg: string
): Promise<string | null> {
  const user = userMsg.slice(0, SLICE);
  const assistant = assistantMsg.slice(0, SLICE);
  if (!user.trim() && !assistant.trim()) return null;

  try {
    const { content } = await generateOnce(
      baseUrl,
      model,
      [{ role: 'user', content: `${TITLE_PROMPT}USER: ${user}\nASSISTANT: ${assistant}` }],
      { numPredict: 50 }
    );

    // Lenient extraction: take the outermost {...} span, ignore surrounding prose.
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const parsed: unknown = JSON.parse(content.slice(start, end + 1));
    const title = (parsed as { title?: unknown }).title;
    if (typeof title !== 'string') return null;
    const clean = title.trim().replace(/^["']|["']$/g, '').slice(0, 60);
    return clean || null;
  } catch {
    return null;
  }
}
