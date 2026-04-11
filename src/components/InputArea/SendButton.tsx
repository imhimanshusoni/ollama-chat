import styles from './InputArea.module.css';

interface Props {
  disabled: boolean;
  onClick: () => void;
}

export function SendButton({ disabled, onClick }: Props) {
  return (
    <button
      className={styles.sendBtn}
      disabled={disabled}
      onClick={onClick}
      aria-label="Send"
      type="button"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}
