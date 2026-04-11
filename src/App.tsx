import { useEffect } from 'react';
import { useStreamResponse } from './hooks/useStreamResponse';
import { useChatStore } from './store/chatStore';
import { useConnectionStore } from './store/connectionStore';
import { useUiStore } from './store/uiStore';
import { fetchModels } from './services/ollama';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TopBar } from './components/TopBar/TopBar';
import { ChatArea } from './components/ChatArea/ChatArea';
import { InputArea } from './components/InputArea/InputArea';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { SettingsOverlay } from './components/Settings/SettingsOverlay';
import styles from './App.module.css';

export default function App() {
  const { send, isStreaming } = useStreamResponse();
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

  // Silent auto-reconnect on load if we have saved URL + model
  useEffect(() => {
    const { baseUrl, currentModel, setStatus, setModels } = useConnectionStore.getState();
    if (baseUrl && currentModel) {
      fetchModels(baseUrl)
        .then((models) => {
          setModels(models);
          setStatus('connected');
        })
        .catch(() => {
          // Silently fail — user can reconnect from settings
        });
    }
  }, []);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <ChatArea isStreaming={isStreaming} />
        <InputArea onSend={send} isStreaming={isStreaming} />
      </div>
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SettingsPanel />
    </div>
  );
}
