import { useEffect } from 'react';
import { useConnectionRetry } from './hooks/useConnectionRetry';
import { useStreamResponse } from './hooks/useStreamResponse';
import { useChatStore } from './store/chatStore';
import { useUiStore } from './store/uiStore';
import { useDocStore } from './store/docStore';
import { usePersonaStore } from './store/personaStore';
import { syncAndConnect } from './services/connection';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TopBar } from './components/TopBar/TopBar';
import { ChatArea } from './components/ChatArea/ChatArea';
import { ConnectionBanner } from './components/ConnectionBanner/ConnectionBanner';
import { InputArea } from './components/InputArea/InputArea';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { SettingsOverlay } from './components/Settings/SettingsOverlay';
import { PersonaChat } from './components/Persona/PersonaChat';
import styles from './App.module.css';

export default function App() {
  const { send, regenerate, editAndResend, isStreaming, abort } = useStreamResponse();
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const personaOpen = useUiStore((s) => s.personaOpen);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const newChat = useChatStore((s) => s.newChat);

  useConnectionRetry();

  // Create initial chat if none exist. Read the store directly so a
  // StrictMode double-run of this effect can't create two chats from the
  // same stale render value.
  useEffect(() => {
    if (useChatStore.getState().conversations.length === 0) {
      newChat();
    }
  }, [conversations.length, newChat]);

  // Auto-sync the tunnel URL + reconnect on load; status flows
  // connecting → connected/error so failures are visible in the UI.
  // Also load RAG documents from IndexedDB and prune any orphaned by deleted
  // chats (startup only, before anything is staged in the composer).
  useEffect(() => {
    void syncAndConnect();
    void useDocStore.getState().hydrate().then(() => useDocStore.getState().pruneOrphans());
    void usePersonaStore.getState().load();
  }, []);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        {personaOpen ? (
          <PersonaChat />
        ) : (
          <>
            <TopBar />
            <ConnectionBanner />
            {/* Keyed per conversation so scroll/sticky state resets on switch */}
            <ChatArea
              key={activeId ?? 'none'}
              isStreaming={isStreaming}
              onRegenerate={regenerate}
              onEditResend={editAndResend}
            />
            <InputArea onSend={send} onStop={abort} isStreaming={isStreaming} />
          </>
        )}
      </div>
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SettingsPanel />
    </div>
  );
}
