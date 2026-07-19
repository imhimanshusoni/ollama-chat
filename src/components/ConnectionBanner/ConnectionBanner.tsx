import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { connect, syncAndConnect } from '../../services/connection';
import styles from './ConnectionBanner.module.css';

/**
 * Inline notice under the top bar when the backend is unreachable — the
 * tunnel URL goes stale every time the Kaggle/Colab session restarts, so this
 * is the primary recovery surface (Settings stays as the manual fallback).
 */
export function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  const errorMessage = useConnectionStore((s) => s.errorMessage);
  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const clearManualOverride = useConnectionStore((s) => s.clearManualOverride);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');

  if (status !== 'error' && status !== 'connecting') return null;

  const connecting = status === 'connecting';

  if (connecting) {
    return (
      <div className={`${styles.banner} ${styles.connecting}`} role="status">
        <span className={styles.dot} />
        <span>Connecting to the model server…</span>
      </div>
    );
  }

  const handleManualConnect = () => {
    if (!urlValue.trim()) return;
    void connect(urlValue, { manual: true });
  };

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.row}>
        <span className={`${styles.dot} ${styles.dotError}`} />
        <span className={styles.message}>
          {errorMessage || 'Could not reach the model server'}
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void connect(baseUrl)}
          >
            Retry
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              clearManualOverride();
              void syncAndConnect();
            }}
          >
            Sync URL from GitHub
          </button>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setShowUrlInput((v) => !v)}
          >
            Use a different URL
          </button>
        </div>
      </div>
      {showUrlInput && (
        <div className={styles.urlRow}>
          <input
            type="text"
            className={styles.urlInput}
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualConnect();
            }}
            placeholder="https://your-url.trycloudflare.com"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleManualConnect}
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
}
