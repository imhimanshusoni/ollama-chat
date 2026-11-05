// The tunnel URL is published in config/model-url.txt on main. raw.githubusercontent
// serves it through a CDN that can keep handing out a dead URL long after a push
// (query-string cache busting doesn't bypass it), so read it via the GitHub
// contents API first: it's at most ~60s stale. That API allows 60 unauthenticated
// requests per hour per IP — fine for a load-time sync plus 45s error retries — and
// raw is kept as the fallback for when it's rate-limited or down.
const MODEL_URL_API_URL =
  'https://api.github.com/repos/imhimanshusoni/ollama-chat/contents/config/model-url.txt?ref=main';
const MODEL_URL_RAW_URL =
  'https://raw.githubusercontent.com/imhimanshusoni/ollama-chat/main/config/model-url.txt';

async function readUrl(url: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      cache: 'no-store',
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const text = (await resp.text()).trim();
    return /^https?:\/\//.test(text) ? text : null;
  } catch {
    return null;
  }
}

export async function fetchRemoteModelUrl(): Promise<string | null> {
  return (
    (await readUrl(MODEL_URL_API_URL, { Accept: 'application/vnd.github.raw+json' })) ??
    (await readUrl(`${MODEL_URL_RAW_URL}?t=${Date.now()}`))
  );
}
