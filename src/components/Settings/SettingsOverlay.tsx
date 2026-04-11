import styles from './SettingsPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsOverlay({ open, onClose }: Props) {
  return (
    <div
      className={`${styles.overlay} ${open ? styles.overlayOpen : ''}`}
      onClick={onClose}
    />
  );
}
