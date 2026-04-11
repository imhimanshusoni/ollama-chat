import { useChatStore } from '../../store/chatStore';
import styles from './Sidebar.module.css';

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 5c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9z" fill="currentColor"/>
      <rect x="21" y="1" width="7" height="8" rx="1" fill="var(--bg-sidebar)"/>
    </svg>
  );
}

export function SidebarHeader() {
  const newChat = useChatStore((s) => s.newChat);

  return (
    <div className={styles.sidebarHeader}>
      <div className={styles.sidebarBrand}>
        <LogoMark />
        Ollama
      </div>
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
