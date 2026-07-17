import styles from './Toggle.module.css';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  label: string; // accessible name
}

export function Toggle({ checked, onChange, id, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      className={`${styles.track} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
