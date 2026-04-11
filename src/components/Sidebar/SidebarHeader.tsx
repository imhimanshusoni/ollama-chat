import { useChatStore } from '../../store/chatStore';
import styles from './Sidebar.module.css';

export function SidebarHeader() {
  const newChat = useChatStore((s) => s.newChat);

  return (
    <div className={styles.sidebarHeader}>
      <div className={styles.sidebarBrand}>Ollama</div>
      <button
        className={styles.btnNewChat}
        onClick={() => newChat()}
        type="button"
        aria-label="Start new chat"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New chat
      </button>
    </div>
  );
}
