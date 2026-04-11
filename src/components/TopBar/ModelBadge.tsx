import { useConnectionStore } from '../../store/connectionStore';
import { StatusDot } from '../ui/StatusDot';

export function ModelBadge() {
  const currentModel = useConnectionStore((s) => s.currentModel);
  const status = useConnectionStore((s) => s.status);

  // Map 'connecting' to 'idle' for the StatusDot which expects 'idle' | 'connected' | 'error'
  const dotStatus: 'idle' | 'connected' | 'error' =
    status === 'connecting' ? 'idle' : status;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: 'var(--font-sm)',
        fontWeight: 500,
        color: 'var(--text-1)',
      }}
    >
      <StatusDot status={dotStatus} />
      <span>{currentModel || 'Not connected'}</span>
    </div>
  );
}
