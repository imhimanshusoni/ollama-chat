const MODEL_URL_RAW_URL =
  'https://raw.githubusercontent.com/imhimanshusoni/ollama-chat/main/config/model-url.txt';

export async function fetchRemoteModelUrl(): Promise<string | null> {
  try {
    const resp = await fetch(`${MODEL_URL_RAW_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const text = (await resp.text()).trim();
    if (!/^https?:\/\//.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}
