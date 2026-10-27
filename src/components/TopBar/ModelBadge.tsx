import { useConnectionStore } from '../../store/connectionStore';
import { Mascot } from '../Mascot/Mascot';
import { connectionLabel, connectionMood } from '../Mascot/mood';

// Connection state as the mascot shows it. The model name lives in the
// composer chip; here it is only the accessible name and tooltip.
export function ModelBadge({ className }: { className?: string }) {
  const currentModel = useConnectionStore((s) => s.currentModel);
  const status = useConnectionStore((s) => s.status);

  return (
    <span role="status" className={className}>
      <Mascot mood={connectionMood(status)} size={30} label={connectionLabel(status, currentModel)} />
    </span>
  );
}
