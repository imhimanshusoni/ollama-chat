import type { MascotMood } from './mood';
import styles from './Mascot.module.css';

interface Props {
  mood?: MascotMood;
  size?: number; // rendered px
  label?: string; // accessible name; omit when the mascot is decorative
  className?: string;
}

// Pip, the app's companion: a coral pebble with a spark antenna. Its mood is
// the live state indicator wherever the app has state (connection, waiting
// for the first token, streaming). Drawn at 64×64 and scaled.
export function Mascot({ mood = 'idle', size = 32, label, className }: Props) {
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };

  return (
    <svg
      className={`${styles.mascot} ${styles[mood]}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      {...a11y}
    >
      {label && <title>{label}</title>}
      <ellipse className={styles.shadow} cx="32" cy="58.5" rx="15" ry="2.4" />

      <g className={styles.figure}>
        <ellipse cx="24.5" cy="53.5" rx="4.4" ry="2.4" fill="var(--mascot-shade)" />
        <ellipse cx="39.5" cy="53.5" rx="4.4" ry="2.4" fill="var(--mascot-shade)" />

        <path
          className={styles.stem}
          d="M32 17.5 C31 13.5 32.6 11 33.2 9.6"
          fill="none"
          stroke="var(--mascot-shade)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          className={styles.spark}
          d="M33.4 2.6 L34.8 6 L38.2 7.4 L34.8 8.8 L33.4 12.2 L32 8.8 L28.6 7.4 L32 6 Z"
          fill="var(--mascot-body)"
        />

        <path
          className={styles.body}
          d="M32 16.5 C44.5 16.5 52.5 25 52.5 36.5 C52.5 47.5 43.5 54.5 32 54.5 C20.5 54.5 11.5 47.5 11.5 36.5 C11.5 25 19.5 16.5 32 16.5 Z"
          fill="var(--mascot-body)"
        />
        <ellipse
          cx="25" cy="25.5" rx="6.5" ry="3.2"
          fill="#fffdf9" opacity="0.2"
          transform="rotate(-24)"
        />
        <circle cx="20.5" cy="41" r="3.2" fill="var(--mascot-cheek)" opacity="0.5" />
        <circle cx="43.5" cy="41" r="3.2" fill="var(--mascot-cheek)" opacity="0.5" />

        <Face mood={mood} />
      </g>

      {mood === 'sleeping' && (
        <g className={styles.zzz} fill="var(--mascot-shade)">
          <circle cx="50" cy="16" r="1.4" />
          <circle cx="54.5" cy="10.5" r="2" />
          <circle cx="60" cy="4.5" r="2.6" />
        </g>
      )}
    </svg>
  );
}

function Face({ mood }: { mood: MascotMood }) {
  const ink = 'var(--mascot-ink)';
  const line = { fill: 'none', stroke: ink, strokeWidth: 2.3, strokeLinecap: 'round' as const };

  if (mood === 'sleeping') {
    return (
      <g>
        <path d="M22 35.5 Q25.5 38.6 29 35.5" {...line} />
        <path d="M35 35.5 Q38.5 38.6 42 35.5" {...line} />
        <ellipse cx="32" cy="43.2" rx="1.6" ry="1.2" fill={ink} opacity="0.75" />
      </g>
    );
  }

  if (mood === 'happy') {
    return (
      <g>
        <path d="M22 37 Q25.5 32.4 29 37" {...line} />
        <path d="M35 37 Q38.5 32.4 42 37" {...line} />
        <path d="M28.4 41.2 Q32 46.4 35.6 41.2 Z" fill={ink} />
      </g>
    );
  }

  // Eyes glance up and to the right while thinking.
  const look = mood === 'thinking' ? { dx: 1.6, dy: -2 } : { dx: 0, dy: 0 };
  return (
    <g>
      <g className={styles.eyes} style={{ transform: `translate(${look.dx}px, ${look.dy}px)` }}>
        <ellipse cx="25.5" cy="35.5" rx="2.7" ry="3.5" fill={ink} />
        <ellipse cx="38.5" cy="35.5" rx="2.7" ry="3.5" fill={ink} />
        <circle cx="26.5" cy="34.2" r="0.95" fill="#fffdf9" />
        <circle cx="39.5" cy="34.2" r="0.95" fill="#fffdf9" />
      </g>
      {mood === 'talking' ? (
        <ellipse className={styles.mouthTalk} cx="32" cy="43" rx="2.4" ry="1.8" fill={ink} />
      ) : mood === 'thinking' ? (
        <path d="M30 43 Q31.5 42 33 43 T36 43" {...line} strokeWidth={1.9} />
      ) : (
        <path d="M29.2 42 Q32 44.6 34.8 42" {...line} strokeWidth={2} />
      )}
    </g>
  );
}
