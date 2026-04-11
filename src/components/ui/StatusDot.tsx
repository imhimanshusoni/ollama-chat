interface StatusDotProps {
  status: 'idle' | 'connected' | 'error';
}

const statusColors: Record<StatusDotProps['status'], string> = {
  idle: 'var(--text-3)',
  connected: 'var(--success)',
  error: 'var(--error)',
};

export function StatusDot({ status }: StatusDotProps) {
  return (
    <div
      style={{
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: 'var(--radius-full)',
        background: statusColors[status],
        flexShrink: 0,
        transition: 'background 0.3s var(--ease)',
      }}
      role="status"
      aria-label={`Connection status: ${status}`}
    />
  );
}
