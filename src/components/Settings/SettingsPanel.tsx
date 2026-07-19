import { useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useUiStore } from '../../store/uiStore';
import { connect, normalizeUrl, syncAndConnect } from '../../services/connection';
import { IconButton } from '../ui/IconButton';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const {
    baseUrl,
    models,
    status,
    isManualOverride,
    clearManualOverride,
  } = useConnectionStore();
  const [urlValue, setUrlValue] = useState(baseUrl);
  const [connectText, setConnectText] = useState('Connect');
  const [syncing, setSyncing] = useState(false);
  // Track focus in a ref so this only fires when baseUrl actually changes (e.g.
  // a background auto-sync). Keying the effect on a focus *state* would also run
  // on blur — resetting the field to the old baseUrl right as the user clicks
  // Connect, discarding what they just typed.
  const inputFocusedRef = useRef(false);

  useEffect(() => {
    if (!inputFocusedRef.current) setUrlValue(baseUrl);
  }, [baseUrl]);

  const handleConnect = async () => {
    const url = normalizeUrl(urlValue);
    if (!url) return;
    setUrlValue(url);
    setConnectText('Connecting...');
    const ok = await connect(url, { manual: true });
    setConnectText(ok ? 'Reconnect' : 'Retry');
  };

  const handleSyncFromGithub = async () => {
    setSyncing(true);
    try {
      clearManualOverride();
      const ok = await syncAndConnect();
      setConnectText(ok ? 'Reconnect' : 'Retry');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={`${styles.panel} ${settingsOpen ? styles.panelOpen : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>Settings</span>
        <IconButton
          label="Close settings"
          onClick={() => setSettingsOpen(false)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </div>
      <div className={styles.body}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="settings-url">Ollama URL</label>
          <input
            type="text"
            className={styles.fieldInput}
            id="settings-url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onFocus={() => { inputFocusedRef.current = true; }}
            onBlur={() => { inputFocusedRef.current = false; }}
            placeholder="https://your-url.trycloudflare.com"
            spellCheck={false}
            autoComplete="off"
          />
          <p className={styles.fieldHint}>
            {isManualOverride ? (
              <>
                Manually set, not auto-synced.{' '}
                <button className={styles.linkBtn} onClick={handleSyncFromGithub} type="button" disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Sync from GitHub'}
                </button>
              </>
            ) : (
              'Auto-synced from GitHub'
            )}
          </p>
        </div>
        <button className={styles.btnConnect} onClick={handleConnect} type="button">
          {connectText}
        </button>
        {status !== 'idle' && (
          <div className={styles.statusRow}>
            <div className={`${styles.statusDot} ${status === 'connected' ? styles.statusConnected : status === 'error' ? styles.statusError : ''}`} />
            <span>
              {status === 'connected' ? `Connected — ${models.length} model${models.length !== 1 ? 's' : ''}` :
               status === 'error' ? 'Connection failed' :
               status === 'connecting' ? 'Connecting...' : ''}
            </span>
          </div>
        )}
        {status === 'connected' && (
          <p className={styles.fieldHint}>
            Pick your model and thinking level from the controls next to the message box.
          </p>
        )}
      </div>
    </div>
  );
}
