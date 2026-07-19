import { useState } from 'react';
import type { MouseEvent } from 'react';
import styles from './ChatItem.module.css';

interface ChatItemProps {
  id: string;
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

export function ChatItem({ id, title, isActive, onSelect, onDelete, onRename }: ChatItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const startRename = () => {
    setDraft(title);
    setEditing(true);
  };

  const commitRename = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== title) onRename(draft);
  };

  // An <input> can't legally nest inside the row <button>, so edit mode
  // renders a sibling layout with the same look.
  if (editing) {
    return (
      <div className={`${styles.chatItem}${isActive ? ` ${styles.active}` : ''}`}>
        <input
          className={styles.renameInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label={`Rename chat: ${title}`}
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      className={`${styles.chatItem}${isActive ? ` ${styles.active}` : ''}`}
      onClick={onSelect}
      onDoubleClick={startRename}
      type="button"
      aria-current={isActive ? 'true' : undefined}
      data-chat-id={id}
    >
      <span className={styles.title}>{title}</span>
      <span
        className={styles.iconBtn}
        role="button"
        tabIndex={0}
        aria-label={`Rename chat: ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          startRename();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            startRename();
          }
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </span>
      <span
        className={`${styles.iconBtn} ${styles.deleteBtn}`}
        role="button"
        tabIndex={0}
        aria-label={`Delete chat: ${title}`}
        onClick={handleDelete}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </button>
  );
}
