import { useEffect } from 'react';
import { useStreamResponse } from './hooks/useStreamResponse';
import { useChatStore } from './store/chatStore';
import { useConnectionStore } from './store/connectionStore';
import { useUiStore } from './store/uiStore';
import { fetchModels, warmModel } from './services/ollama';
import { fetchRemoteModelUrl } from './services/remoteConfig';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TopBar } from './components/TopBar/TopBar';
import { ChatArea } from './components/ChatArea/ChatArea';
import { InputArea } from './components/InputArea/InputArea';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { SettingsOverlay } from './components/Settings/SettingsOverlay';
import styles from './App.module.css';

export default function App() {
  const { send, isStreaming, abort } = useStreamResponse();
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const conversations = useChatStore((s) => s.conversations);
  const newChat = useChatStore((s) => s.newChat);

  // Create initial chat if none exist
  useEffect(() => {
    if (conversations.length === 0) {
      newChat();
    }
  }, [conversations.length, newChat]);

  // Silent auto-sync + auto-reconnect on load
  useEffect(() => {
    async function syncAndConnect() {
      const { baseUrl, currentModel, isManualOverride, setBaseUrl, setCurrentModel, setStatus, setModels } =
        useConnectionStore.getState();

      let effectiveUrl = baseUrl;
      if (!isManualOverride) {
        const remoteUrl = await fetchRemoteModelUrl();
        if (remoteUrl && remoteUrl !== baseUrl) {
          setBaseUrl(remoteUrl);
          effectiveUrl = remoteUrl;
        }
      }

      if (!effectiveUrl) return;
      try {
        const modelList = await fetchModels(effectiveUrl);
        setModels(modelList);
        setStatus('connected');
        const model = modelList.includes(currentModel) ? currentModel : modelList[0] ?? '';
        if (model) {
          setCurrentModel(model);
          void warmModel(effectiveUrl, model); // preload the model on load
        }
      } catch {
        // Silently fail — user can reconnect from settings
      }
    }
    void syncAndConnect();
  }, []);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <ChatArea isStreaming={isStreaming} />
        <InputArea onSend={send} onStop={abort} isStreaming={isStreaming} />
      </div>
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SettingsPanel />
    </div>
  );
}
