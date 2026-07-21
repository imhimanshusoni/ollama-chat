import { useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useUiStore } from '../../store/uiStore';
import { useDocStore } from '../../store/docStore';
import { usePersonaStore } from '../../store/personaStore';
import { PersonaAvatar } from '../Persona/PersonaAvatar';
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
  const personaOpen = useUiStore((s) => s.personaOpen);
  const setPersonaOpen = useUiStore((s) => s.setPersonaOpen);
  const persona = usePersonaStore((s) => s.persona);

  const openPersona = useCallback(() => {
    setPersonaOpen(true);
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }, [setPersonaOpen, setSidebarOpen]);

  const handleSelect = useCallback((id: string) => {
    switchChat(id);
    // Close sidebar on mobile after selecting a chat
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [switchChat, setSidebarOpen]);

  // Delete a chat and immediately free any documents it owned (they aren't
  // shared, so a deleted chat's docs are pure orphans). Capture the ids before
  // deleting, then prune just those.
  const handleDelete = useCallback((id: string) => {
    const docIds = useChatStore.getState().conversations.find((c) => c.id === id)?.docIds ?? [];
    deleteChat(id);
    if (docIds.length) void useDocStore.getState().pruneOrphans(docIds);
  }, [deleteChat]);

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

        <button
          type="button"
          className={`${styles.personaEntry} ${personaOpen ? styles.personaEntryActive : ''}`}
          onClick={openPersona}
        >
          <PersonaAvatar avatar={persona?.avatar ?? '🙂'} className={styles.personaAvatar} />
          <span className={styles.personaLabel}>Chat with {persona?.name ?? 'someone'}</span>
        </button>

        <div className={styles.sidebarChats}>
          {conversations.map((c) => (
            <ChatItem
              key={c.id}
              id={c.id}
              title={c.title}
              isActive={c.id === activeId}
              onSelect={() => handleSelect(c.id)}
              onDelete={() => handleDelete(c.id)}
              onRename={(title) => renameChat(c.id, title)}
            />
          ))}
        </div>

        <SidebarFooter />
      </aside>
    </>
  );
}
