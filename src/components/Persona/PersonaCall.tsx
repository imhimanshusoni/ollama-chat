import { useEffect } from 'react';
import { usePersonaStore } from '../../store/personaStore';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import { PersonaAvatar } from './PersonaAvatar';
import styles from './PersonaCall.module.css';

interface Props {
  onClose: () => void;
}

// Full-screen, phone-style call overlay for talking to the persona out loud.
export function PersonaCall({ onClose }: Props) {
  const persona = usePersonaStore((s) => s.persona);
  const { callState, interim, lastUserText, lastReply, muted, error, startCall, endCall, toggleMute } =
    useVoiceCall();

  const name = persona?.name ?? 'Persona';
  const avatar = persona?.avatar ?? '🙂';

  // Auto-start when the overlay opens; always tear down on close.
  useEffect(() => {
    startCall();
    return () => endCall();
  }, [startCall, endCall]);

  const hangUp = () => {
    endCall();
    onClose();
  };

  const status = error
    ? error
    : muted
      ? 'muted'
      : callState === 'thinking'
        ? 'thinking…'
        : callState === 'speaking'
          ? 'speaking…'
          : 'listening…';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Call with ${name}`}>
      <div className={styles.top}>
        <div className={`${styles.avatarRing} ${callState === 'speaking' ? styles.speaking : ''}`}>
          <PersonaAvatar avatar={avatar} className={styles.avatar} />
        </div>
        <div className={styles.name}>{name}</div>
        <div className={`${styles.status} ${error ? styles.statusError : ''}`}>{status}</div>
      </div>

      <div className={styles.captions}>
        {lastUserText && (
          <div className={styles.captionRow}>
            <span className={styles.captionLabel}>you</span>
            <span className={styles.captionText}>{lastUserText}</span>
          </div>
        )}
        {interim && (
          <div className={`${styles.captionRow} ${styles.captionInterim}`}>
            <span className={styles.captionLabel}>you</span>
            <span className={styles.captionText}>{interim}</span>
          </div>
        )}
        {lastReply && (
          <div className={styles.captionRow}>
            <span className={styles.captionLabel}>{name.toLowerCase()}</span>
            <span className={styles.captionText}>{lastReply}</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.controlBtn} ${muted ? styles.controlActive : ''}`}
          onClick={toggleMute}
          type="button"
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          )}
        </button>

        <button
          className={styles.endBtn}
          onClick={hangUp}
          type="button"
          aria-label="End call"
          title="End call"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-1.78 1.78c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.66-1.85.998.998 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
