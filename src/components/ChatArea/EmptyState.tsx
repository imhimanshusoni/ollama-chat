import styles from './EmptyState.module.css';

export function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.title}>Start a conversation</div>
      <p className={styles.sub}>
        Connect to your Ollama instance in settings, then ask anything.
      </p>
    </div>
  );
}
