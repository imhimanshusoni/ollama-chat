// Real web search for the web_search tool, called directly from the browser.
// Tavily is the active provider (CORS-friendly, free 1,000 searches/month,
// LLM-ready snippets). A Serper stub is kept below as a one-line-swap seam.
//
// All failures are returned as strings rather than thrown so the model can
// relay them to the user sensibly.
//
// The API key comes from a build-time env var (VITE_TAVILY_API_KEY), set in
// the Vercel project settings. Note: Vite inlines VITE_* vars into the client
// bundle, so this key is not a server secret — it ships in the published JS.
// That's acceptable for a personal free-tier key; keep the key rate-limited.

const API_KEY = (import.meta.env.VITE_TAVILY_API_KEY ?? '').trim();

// Whether web search can run at all. Callers use this to avoid offering the
// tool (or mentioning it) when no key is configured.
export function isSearchConfigured(): boolean {
  return API_KEY.length > 0;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

type SearchProviderFn = (
  query: string,
  apiKey: string,
  signal?: AbortSignal
) => Promise<{ results: SearchResult[]; answer?: string }>;

const SNIPPET_CAP = 350;
const TOTAL_CAP = 2000;

interface TavilyResponse {
  answer?: string;
  results?: { title?: string; url?: string; content?: string }[];
}

const tavilySearch: SearchProviderFn = async (query, apiKey, signal) => {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: 5,
      search_depth: 'basic',
      include_answer: true,
    }),
    signal,
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data: TavilyResponse = await resp.json();
  return {
    answer: data.answer,
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    })),
  };
};

// Unwired alternative provider (Google SERP via Serper, free 2,500 queries,
// CORS `*`, header X-API-KEY). To swap: change `provider` below and update the
// Settings hint. Response shape: { organic: [{ title, link, snippet }] }.
//
// const serperSearch: SearchProviderFn = async (query, apiKey, signal) => {
//   const resp = await fetch('https://google.serper.dev/search', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
//     body: JSON.stringify({ q: query }),
//     signal,
//   });
//   if (!resp.ok) throw new Error('HTTP ' + resp.status);
//   const data = await resp.json();
//   return {
//     results: (data.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
//       title: r.title ?? '', url: r.link ?? '', snippet: r.snippet ?? '',
//     })),
//   };
// };

const provider: SearchProviderFn = tavilySearch;

export async function searchWeb(query: string, signal?: AbortSignal): Promise<string> {
  if (!isSearchConfigured()) {
    return 'Error: web search is unavailable. Answer from your own knowledge and say the search is unavailable.';
  }

  let answer: string | undefined;
  let results: SearchResult[];
  try {
    ({ answer, results } = await provider(query, API_KEY, signal));
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'HTTP 429' || message === 'HTTP 432') {
      return 'Error: search quota exceeded for this month.';
    }
    return `Error: search failed (${message}). Answer from your own knowledge and say the search failed.`;
  }

  if (results.length === 0 && !answer) {
    return `No results found for "${query}". Try a differently-worded query once, or answer from your own knowledge.`;
  }

  const parts: string[] = [];
  if (answer) parts.push(`Answer: ${answer}`);
  results.forEach((r, i) => {
    const snippet = r.snippet.length > SNIPPET_CAP ? r.snippet.slice(0, SNIPPET_CAP) + '…' : r.snippet;
    parts.push(`${i + 1}. ${r.title}\n${r.url}\n${snippet}`);
  });

  const out = parts.join('\n\n');
  return out.length > TOTAL_CAP ? out.slice(0, TOTAL_CAP) + '…' : out;
}
