import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useUiStore } from '../../store/uiStore';
import { fetchModels, warmModel } from '../../services/ollama';
import { IconButton } from '../ui/IconButton';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const { baseUrl, currentModel, models, status, setBaseUrl, setCurrentModel, setModels, setStatus } = useConnectionStore();
  const [urlValue, setUrlValue] = useState(baseUrl);
  const [connectText, setConnectText] = useState('Connect');

  const handleConnect = async () => {
    let url = urlValue.trim().replace(/\/+$/, '');
    if (!url) return;
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    setUrlValue(url);
    setConnectText('Connecting...');
    setStatus('connecting');

    try {
      const modelList = await fetchModels(url);
      setBaseUrl(url);
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
            placeholder="https://your-url.trycloudflare.com"
            spellCheck={false}
            autoComplete="off"
          />
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
      </div>
    </div>
  );
}
