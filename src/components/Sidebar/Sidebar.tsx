import { useCallback } from 'react';
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
  const renameChat = useChatStore((s) => s.renameChat);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  const handleSelect = useCallback((id: string) => {
    switchChat(id);
    // Close sidebar on mobile after selecting a chat
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [switchChat, setSidebarOpen]);

  return (
    <>
      {/* Overlay backdrop — mobile only, visible when sidebar is open */}
      <div
        className={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
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
              onSelect={() => handleSelect(c.id)}
              onDelete={() => deleteChat(c.id)}
              onRename={(title) => renameChat(c.id, title)}
            />
          ))}
        </div>

        <SidebarFooter />
      </aside>
    </>
  );
}
