import type { MouseEvent } from 'react';
import styles from './ChatItem.module.css';

interface ChatItemProps {
  id: string;
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ChatItem({ id, title, isActive, onSelect, onDelete }: ChatItemProps) {
  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <button
      className={`${styles.chatItem}${isActive ? ` ${styles.active}` : ''}`}
      onClick={onSelect}
      type="button"
      aria-current={isActive ? 'true' : undefined}
      data-chat-id={id}
    >
      <span className={styles.title}>{title}</span>
      <span
        className={styles.deleteBtn}
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
