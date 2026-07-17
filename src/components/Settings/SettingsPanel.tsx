import { useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUiStore } from '../../store/uiStore';
import { fetchModels, warmModel } from '../../services/ollama';
import { fetchRemoteModelUrl } from '../../services/remoteConfig';
import { IconButton } from '../ui/IconButton';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const {
    baseUrl,
    currentModel,
    models,
    status,
    isManualOverride,
    setBaseUrl,
    setCurrentModel,
    setModels,
    setStatus,
    clearManualOverride,
  } = useConnectionStore();
  const systemPromptOverride = useSettingsStore((s) => s.systemPromptOverride);
  const setSystemPromptOverride = useSettingsStore((s) => s.setSystemPromptOverride);
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

  const connectTo = async (rawUrl: string, opts?: { manual?: boolean }) => {
    let url = rawUrl.trim().replace(/\/+$/, '');
    if (!url) return;
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    setUrlValue(url);
    setConnectText('Connecting...');
    setStatus('connecting');

    try {
      const modelList = await fetchModels(url);
      setBaseUrl(url, opts);
      setModels(modelList);
      if (modelList.length > 0) {
        const saved = currentModel;
        const model = modelList.includes(saved) ? saved : modelList[0];
        setCurrentModel(model);
        void warmModel(url, model); // preload so the first message is fast
      }
      setStatus('connected');
      setConnectText('Reconnect');
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Connection failed');
      setConnectText('Retry');
    }
  };

  const handleConnect = () => connectTo(urlValue, { manual: true });

  const handleSyncFromGithub = async () => {
    setSyncing(true);
    try {
      const remoteUrl = await fetchRemoteModelUrl();
      if (remoteUrl) {
        clearManualOverride();
        await connectTo(remoteUrl);
      }
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
            Pick your model and toggle reasoning from the controls next to the message box.
          </p>
        )}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="settings-system-prompt">System prompt</label>
          <textarea
            className={`${styles.fieldInput} ${styles.fieldTextarea}`}
            id="settings-system-prompt"
            value={systemPromptOverride}
            onChange={(e) => setSystemPromptOverride(e.target.value)}
            placeholder="Leave empty to use the default"
            rows={4}
            spellCheck={false}
          />
          <p className={styles.fieldHint}>
            Sets the assistant's behavior for every chat. Tool instructions are added automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
