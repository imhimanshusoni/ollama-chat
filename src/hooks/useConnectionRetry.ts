import { useEffect } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { syncAndConnect } from '../services/connection';

const RETRY_INTERVAL_MS = 45_000;

/**
 * While the connection is in an error state, periodically re-run the full
 * sync-and-connect (re-fetching the GitHub-published tunnel URL each time —
 * a restarted Kaggle/Colab session mints a new URL) and retry immediately on
 * window focus. The service's in-flight guard prevents stacked attempts;
 * the 10s connect timeout + 45s interval bounds the request rate.
 */
export function useConnectionRetry() {
  useEffect(() => {
    const retryIfDown = () => {
      if (
        useConnectionStore.getState().status === 'error' &&
        document.visibilityState === 'visible'
      ) {
        void syncAndConnect();
      }
    };

    const interval = setInterval(retryIfDown, RETRY_INTERVAL_MS);
    window.addEventListener('focus', retryIfDown);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', retryIfDown);
    };
  }, []);
}
