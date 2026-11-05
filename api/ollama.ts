// Same-origin proxy to an Ollama server behind an ngrok free tunnel.
//
// ngrok's free tier serves an HTML warning page to browser requests unless they
// carry `ngrok-skip-browser-warning`, and Ollama's CORS preflight doesn't allow
// that header — so the browser can't talk to the tunnel directly. The client
// (src/services/ollama.ts) sends ngrok-bound requests here instead; this adds
// the header server-side and streams Ollama's response straight back.

const ALLOWED_PATHS = new Set(['/api/tags', '/api/chat', '/api/embed']);
const NGROK_SUFFIXES = ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.dev'];

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}

function parseTarget(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    return NGROK_SUFFIXES.some((s) => host.endsWith(s)) ? url : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return jsonError(405, 'Method not allowed');
    }

    const path = new URL(request.url).searchParams.get('path') ?? '';
    if (!ALLOWED_PATHS.has(path)) return jsonError(400, 'Path not allowed');

    const target = parseTarget(request.headers.get('x-ollama-target'));
    if (!target) return jsonError(400, 'Target must be an https ngrok URL');

    const headers: Record<string, string> = { 'ngrok-skip-browser-warning': '1' };
    const contentType = request.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;

    let upstream: Response;
    try {
      upstream = await fetch(target.origin + path, {
        method: request.method,
        headers,
        body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
        // Client disconnect (e.g. the user hits Stop) cancels the upstream call.
        signal: request.signal,
      });
    } catch (err) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      return jsonError(502, `Upstream unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
      },
    });
  },
};
