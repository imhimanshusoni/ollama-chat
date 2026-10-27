import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { connect, syncAndConnect } from '../../services/connection';
import { Mascot } from '../Mascot/Mascot';
import styles from './ConnectionBanner.module.css';

/**
 * Inline notice under the top bar when the backend is unreachable — the
 * tunnel URL goes stale every time the tunnel restarts, so this is the
 * primary recovery surface (Settings stays as the manual fallback). The
 * mascot carries the state; recovery actions are icons.
 */
export function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  const errorMessage = useConnectionStore((s) => s.errorMessage);
  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const clearManualOverride = useConnectionStore((s) => s.clearManualOverride);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');

  if (status !== 'error' && status !== 'connecting') return null;

  if (status === 'connecting') {
    return (
      <div className={`${styles.banner} ${styles.connecting}`} role="status">
        <Mascot mood="thinking" size={30} />
        <span className={styles.pulse} aria-hidden="true"><span /><span /><span /></span>
        <span className="visually-hidden">Connecting to the model server</span>
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
        <Mascot mood="sleeping" size={36} />
        <span className={styles.message}>
          {errorMessage || 'Could not reach the model server'}
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => void connect(baseUrl)}
            aria-label="Retry"
            title="Retry"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              clearManualOverride();
              void syncAndConnect();
            }}
            aria-label="Sync URL from GitHub"
            title="Sync URL from GitHub"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.5 4 4 0 0 0 6.5 17.5" />
              <polyline points="9 15 12 18 15 15" />
              <line x1="12" y1="11" x2="12" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${showUrlInput ? styles.iconBtnOn : ''}`}
            onClick={() => setShowUrlInput((v) => !v)}
            aria-label="Use a different URL"
            aria-expanded={showUrlInput}
            title="Use a different URL"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        </div>
      </div>
      {showUrlInput && (
        <div className={styles.urlRow}>
          <input
            type="url"
            className={styles.urlInput}
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualConnect();
            }}
            placeholder="https://…trycloudflare.com"
            aria-label="Server URL"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
          <button
            type="button"
            className={styles.connectBtn}
            onClick={handleManualConnect}
            aria-label="Connect"
            title="Connect"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
