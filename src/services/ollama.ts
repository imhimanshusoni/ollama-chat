export async function fetchModels(baseUrl: string): Promise<string[]> {
  const resp = await fetch(baseUrl + '/api/tags');
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return (data.models || []).map((m: { name: string }) => m.name);
}

export async function* streamChat(
  baseUrl: string,
  model: string,
  messages: { role: string; content: string }[],
  signal: AbortSignal
): AsyncGenerator<string> {
  const resp = await fetch(baseUrl + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j.message && j.message.content) {
          yield j.message.content;
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  if (buffer.trim()) {
    try {
      const j = JSON.parse(buffer);
      if (j.message && j.message.content) {
        yield j.message.content;
      }
    } catch {
      // skip malformed trailing data
    }
  }
}
