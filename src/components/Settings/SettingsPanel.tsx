import { useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useUiStore } from '../../store/uiStore';
import { connect, normalizeUrl, syncAndConnect } from '../../services/connection';
import { IconButton } from '../ui/IconButton';
import { Mascot } from '../Mascot/Mascot';
import { connectionLabel, connectionMood } from '../Mascot/mood';
import { isEmbedModel } from '../../services/ollama';
import { DocumentsSettings } from './DocumentsSettings';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const {
    baseUrl,
    models,
    status,
    currentModel,
    isManualOverride,
    clearManualOverride,
  } = useConnectionStore();
  const [urlValue, setUrlValue] = useState(baseUrl);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Track focus in a ref so this only fires when baseUrl actually changes (e.g.
  // a background auto-sync). Keying the effect on a focus *state* would also run
  // on blur — resetting the field to the old baseUrl right as the user clicks
  // Connect, discarding what they just typed.
  const inputFocusedRef = useRef(false);

  useEffect(() => {
    if (!inputFocusedRef.current) setUrlValue(baseUrl);
  }, [baseUrl]);

  // Modal sheet focus: move focus in on open, keep Tab inside, close on
  // Escape, and hand focus back to whatever opened it.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!settingsOpen || !panel) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.querySelector<HTMLElement>('button')?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [settingsOpen, setSettingsOpen]);

  const handleConnect = async () => {
    const url = normalizeUrl(urlValue);
    if (!url) return;
    setUrlValue(url);
    setBusy(true);
    try {
      await connect(url, { manual: true });
    } finally {
      setBusy(false);
    }
  };

  const handleSyncFromGithub = async () => {
    setSyncing(true);
    try {
      clearManualOverride();
      await syncAndConnect();
    } finally {
      setSyncing(false);
    }
  };

  const modelCount = models.filter((m) => !isEmbedModel(m)).length;

  return (
    <div
      className={`${styles.panel} ${settingsOpen ? styles.panelOpen : ''}`}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      inert={!settingsOpen}
    >
      <div className={styles.header}>
        <svg className={styles.headerIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2.2" fill="var(--bg-sidebar)" />
          <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2.2" fill="var(--bg-sidebar)" />
          <line x1="4" y1="18" x2="20" y2="18" /><circle cx="8" cy="18" r="2.2" fill="var(--bg-sidebar)" />
        </svg>
        <IconButton
          label="Close settings"
          title="Close"
          onClick={() => setSettingsOpen(false)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </div>
      <div className={styles.body}>
        <section className={styles.server} aria-label="Model server">
          <div className={styles.statusCard}>
            <Mascot mood={connectionMood(status)} size={52} label={connectionLabel(status, currentModel)} />
            <div className={styles.statusSide}>
            {isManualOverride ? (
              <button
                className={styles.syncBtn}
                onClick={() => void handleSyncFromGithub()}
                type="button"
                disabled={syncing}
                aria-label="Manual URL. Sync from GitHub instead"
                title="Manual URL · sync from GitHub"
              >
                <svg className={syncing ? styles.spinning : undefined} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
              </button>
            ) : (
              <span className={styles.synced} title="Auto-synced from GitHub" role="img" aria-label="Auto-synced from GitHub">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.5 4 4 0 0 0 6.5 17.5" />
                  <polyline points="9 15 11.5 17.5 16 13" />
                </svg>
              </span>
            )}
            {status === 'connected' && currentModel && (
              <span className={styles.count} title={`${modelCount} chat model${modelCount !== 1 ? 's' : ''} available`}>
                {currentModel}
              </span>
            )}
            </div>
          </div>

          <div className={styles.urlField}>
            <svg className={styles.urlIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              type="url"
              className={styles.fieldInput}
              id="settings-url"
              aria-label="Ollama server URL"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleConnect(); }}
              onFocus={() => { inputFocusedRef.current = true; }}
              onBlur={() => { inputFocusedRef.current = false; }}
              placeholder="https://…trycloudflare.com"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              className={styles.btnConnect}
              onClick={() => void handleConnect()}
              type="button"
              disabled={busy}
              aria-label={status === 'connected' ? 'Reconnect' : 'Connect'}
              title={status === 'connected' ? 'Reconnect' : 'Connect'}
            >
              {busy ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </div>

        </section>
        <DocumentsSettings />
      </div>
    </div>
  );
}
