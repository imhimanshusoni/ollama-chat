import { useConnectionStore } from '../store/connectionStore';
import { fetchModels, isEmbedModel, warmModel } from './ollama';
import { fetchRemoteModelUrl } from './remoteConfig';

// The retry timer, the window-focus listener, and the banner's Retry button
// can all fire while an attempt is already underway — share one in-flight
// promise so they await the same attempt instead of racing.
let inFlight: Promise<boolean> | null = null;

function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError') return 'Connection timed out — the tunnel may be down';
    if (err instanceof TypeError) return 'Could not reach the server';
    return err.message;
  }
  return 'Connection failed';
}

export function normalizeUrl(rawUrl: string): string {
  let url = rawUrl.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//.test(url)) url = 'https://' + url;
  return url;
}

/**
 * Connect to an Ollama server: fetch its model list, adopt the URL, pick a
 * model (keep the saved one if still present) and warm it. Never throws —
 * the outcome is carried by connectionStore.status. Returns success.
 */
export function connect(rawUrl: string, opts?: { manual?: boolean }): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = doConnect(rawUrl, opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doConnect(rawUrl: string, opts?: { manual?: boolean }): Promise<boolean> {
  const { setBaseUrl, setCurrentModel, setModels, setStatus } = useConnectionStore.getState();

  const url = normalizeUrl(rawUrl);
  if (!url) {
    setStatus('error', 'No server URL configured');
    return false;
  }

  setStatus('connecting');
  try {
    const modelList = await fetchModels(url);
    setBaseUrl(url, opts);
    setModels(modelList);
    if (modelList.length > 0) {
      const saved = useConnectionStore.getState().currentModel;
      // Prefer the saved model; otherwise auto-pick the first chat model,
      // never an embedding model (which can't chat).
      const chatModels = modelList.filter((m) => !isEmbedModel(m));
      const model = modelList.includes(saved) ? saved : (chatModels[0] ?? modelList[0]);
      setCurrentModel(model);
      void warmModel(url, model); // preload so the first message is fast
    }
    setStatus('connected');
    return true;
  } catch (err) {
    setStatus('error', friendlyError(err));
    return false;
  }
}

/**
 * Resolve the freshest URL (GitHub-published tunnel URL unless the user set
 * one manually) and connect to it. Safe to call repeatedly — used by the
 * on-load auto-connect, the retry timer, and the banner actions.
 */
export async function syncAndConnect(): Promise<boolean> {
  const { baseUrl, isManualOverride } = useConnectionStore.getState();

  let effectiveUrl = baseUrl;
  if (!isManualOverride) {
    const remoteUrl = await fetchRemoteModelUrl();
    if (remoteUrl) effectiveUrl = remoteUrl;
  }

  return connect(effectiveUrl, isManualOverride ? { manual: true } : undefined);
}
