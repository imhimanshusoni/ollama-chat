import { useConnectionStore } from '../../store/connectionStore';
import { Mascot } from '../Mascot/Mascot';
import { connectionLabel, connectionMood } from '../Mascot/mood';
import styles from './EmptyState.module.css';

// A fresh chat is just the mascot: awake and pleased when the server is up,
// thinking while connecting, asleep when it can't be reached.
export function EmptyState() {
  const status = useConnectionStore((s) => s.status);
  const model = useConnectionStore((s) => s.currentModel);
  const mood = status === 'connected' ? 'happy' : connectionMood(status);

  return (
    <div className={styles.empty}>
      <Mascot mood={mood} size={128} label={connectionLabel(status, model)} className={styles.mascot} />
    </div>
  );
}
