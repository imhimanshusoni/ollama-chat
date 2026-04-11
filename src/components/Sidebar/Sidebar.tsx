import { useChatStore } from '../../store/chatStore';
import { useUiStore } from '../../store/uiStore';
import { SidebarHeader } from './SidebarHeader';
import { ChatItem } from './ChatItem';
import { SidebarFooter } from './SidebarFooter';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const switchChat = useChatStore((s) => s.switchChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <aside
      className={`${styles.sidebar}${sidebarOpen ? ` ${styles.open}` : ''}`}
      aria-label="Chat sidebar"
    >
      <SidebarHeader />

      <div className={styles.sidebarChats}>
        {conversations.map((c) => (
          <ChatItem
            key={c.id}
            id={c.id}
            title={c.title}
            isActive={c.id === activeId}
            onSelect={() => switchChat(c.id)}
            onDelete={() => deleteChat(c.id)}
          />
        ))}
      </div>

      <SidebarFooter />
    </aside>
  );
}
