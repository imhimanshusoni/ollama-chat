import { useUiStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import { IconButton } from '../ui/IconButton';
import { ModelBadge } from './ModelBadge';
import styles from './TopBar.module.css';

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.setSidebarOpen);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setPersonaOpen = useUiStore((s) => s.setPersonaOpen);
  const newChat = useChatStore((s) => s.newChat);

  const startChat = () => {
    newChat();
    setPersonaOpen(false);
  };

  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <IconButton
          className={styles.hamburger}
          onClick={() => toggleSidebar(!sidebarOpen)}
          title="Toggle sidebar"
          label="Toggle sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="14" y2="12" />
            <line x1="4" y1="17" x2="17" y2="17" />
          </svg>
        </IconButton>

        <ModelBadge className={styles.badge} />
      </div>

      <div className={styles.topbarRight}>
        <IconButton
          className={styles.settings}
          onClick={startChat}
          title="New chat"
          label="New chat"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
