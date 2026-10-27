import type { ConnectionStatus } from '../../types';

export type MascotMood = 'idle' | 'happy' | 'thinking' | 'talking' | 'sleeping';

// The server's state, as the mascot shows it: awake when connected, thinking
// while connecting, asleep when unreachable or not yet configured.
export function connectionMood(status: ConnectionStatus): MascotMood {
  if (status === 'connected') return 'idle';
  if (status === 'connecting') return 'thinking';
  return 'sleeping';
}

export function connectionLabel(status: ConnectionStatus, model?: string): string {
  if (status === 'connected') return model ? `Connected · ${model}` : 'Connected';
  if (status === 'connecting') return 'Connecting to the model server';
  if (status === 'error') return 'Model server unreachable';
  return 'Not connected';
}
