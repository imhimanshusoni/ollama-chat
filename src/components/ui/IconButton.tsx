import type { ReactNode, MouseEventHandler } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
  title?: string;
  label: string;
  className?: string;
  children: ReactNode;
}

export function IconButton({ onClick, title, label, className, children }: IconButtonProps) {
  return (
    <button
      className={`${styles.iconBtn}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={title}
      aria-label={label}
      type="button"
    >
      {children}
    </button>
  );
}
