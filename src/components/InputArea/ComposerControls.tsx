import { useRef, useState, useCallback } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useChatStore } from '../../store/chatStore';
import { isEmbedModel, warmModel } from '../../services/ollama';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { ThinkLevel } from '../../types';
import styles from './ComposerControls.module.css';

// Strip the tag suffix for a compact chip label: "gemma4:12b-it-q4_K_M" -> "gemma4".
function shortModel(name: string): string {
  return name.split(':')[0] || name;
}

const THINK_LEVELS: { value: ThinkLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

// Compact chip label for the current thinking level.
function thinkChipLabel(level: ThinkLevel): string {
  return level === 'off' ? 'Fast' : `Think: ${THINK_LEVELS.find((l) => l.value === level)?.label}`;
}

export function ComposerControls() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close);

  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const allModels = useConnectionStore((s) => s.models);
  // Embedding models (e.g. nomic-embed-text) can't chat — keep them out of the picker.
  const models = allModels.filter((m) => !isEmbedModel(m));
  const currentModel = useConnectionStore((s) => s.currentModel);
  const setCurrentModel = useConnectionStore((s) => s.setCurrentModel);
  // Thinking level is per-conversation, so each chat remembers its own setting.
  const activeId = useChatStore((s) => s.activeId);
  const thinkLevel = useChatStore((s) => s.conversations.find((c) => c.id === s.activeId)?.thinkLevel ?? 'off');
  const setThinkLevel = useChatStore((s) => s.setThinkLevel);

  const pickModel = useCallback((m: string) => {
    setCurrentModel(m);
    void warmModel(baseUrl, m);
    setOpen(false);
  }, [setCurrentModel, baseUrl]);

  return (
    <div className={styles.root} ref={rootRef}>
      {open && (
        <div className={styles.popover} role="menu">
          <div className={styles.sectionLabel}>Model</div>
          {models.length === 0 ? (
            <p className={styles.empty}>Connect in settings to load models.</p>
          ) : (
            <ul className={styles.modelList}>
              {models.map((m) => {
                const active = m === currentModel;
                return (
                  <li key={m}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className={`${styles.modelItem} ${active ? styles.modelActive : ''}`}
                      onClick={() => pickModel(m)}
                    >
                      <span className={styles.modelName}>{m}</span>
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={styles.divider} />

          <div className={styles.thinkRow}>
            <div className={styles.reasoningText}>
              <span className={styles.reasoningTitle}>Thinking</span>
              <span className={styles.reasoningHint}>Higher thinks more. Slower, more thorough.</span>
            </div>
            <div className={styles.segments} role="radiogroup" aria-label="Thinking level">
              {THINK_LEVELS.map(({ value, label }) => {
                const active = value === thinkLevel;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`${styles.segment} ${active ? styles.segmentActive : ''}`}
                    onClick={() => { if (activeId) setThinkLevel(activeId, value); }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className={styles.chip}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={styles.chipModel}>{currentModel ? shortModel(currentModel) : 'No model'}</span>
        <span className={styles.chipSep} aria-hidden="true">·</span>
        <span className={thinkLevel !== 'off' ? styles.chipModeOn : styles.chipMode}>
          {thinkChipLabel(thinkLevel)}
        </span>
        <svg className={`${styles.chevron} ${open ? styles.chevronUp : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
