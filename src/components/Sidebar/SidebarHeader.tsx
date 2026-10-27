import { useChatStore } from '../../store/chatStore';
import { useUiStore } from '../../store/uiStore';
import { useConnectionStore } from '../../store/connectionStore';
import { Mascot } from '../Mascot/Mascot';
import { connectionLabel, connectionMood } from '../Mascot/mood';
import styles from './Sidebar.module.css';

export function SidebarHeader() {
  const newChat = useChatStore((s) => s.newChat);
  const setPersonaOpen = useUiStore((s) => s.setPersonaOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const status = useConnectionStore((s) => s.status);
  const model = useConnectionStore((s) => s.currentModel);

  const startChat = () => {
    newChat();
    setPersonaOpen(false);
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  return (
    <div className={styles.sidebarHeader}>
      <Mascot
        mood={connectionMood(status)}
        size={34}
        label={connectionLabel(status, model)}
        className={styles.brandMascot}
      />
      <button
        className={styles.btnNewChat}
        onClick={startChat}
        type="button"
        aria-label="New chat"
        title="New chat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </div>
  );
}
