import { useRef, useState, useCallback, type KeyboardEvent } from 'react';
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

const THINK_LEVELS: { value: ThinkLevel; label: string; bars: number }[] = [
  { value: 'off', label: 'Fast, no thinking', bars: 0 },
  { value: 'low', label: 'Think a little', bars: 1 },
  { value: 'medium', label: 'Think more', bars: 2 },
  { value: 'high', label: 'Think hard', bars: 3 },
];

// A thinking level drawn as a glyph: a bolt for "off", 1–3 rising bars otherwise.
function LevelGlyph({ bars }: { bars: number }) {
  if (bars === 0) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={4 + i * 6.5}
          y={15 - i * 5}
          width="3.6"
          height={6 + i * 5}
          rx="1.4"
          fill="currentColor"
          opacity={i < bars ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}

export function ComposerControls() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close);

  // Escape closes the popover and hands focus back to its trigger.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  }, [open]);

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

  const level = THINK_LEVELS.find((l) => l.value === thinkLevel) ?? THINK_LEVELS[0];

  const pickModel = useCallback((m: string) => {
    setCurrentModel(m);
    void warmModel(baseUrl, m);
    setOpen(false);
  }, [setCurrentModel, baseUrl]);

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={handleKeyDown}>
      {open && (
        <div className={styles.popover} role="menu">
          {models.length === 0 ? (
            <p className={styles.empty}>No models — connect first.</p>
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

          <div className={styles.segments} role="radiogroup" aria-label="Thinking level">
            {THINK_LEVELS.map(({ value, label, bars }) => {
              const active = value === thinkLevel;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={label}
                  title={label}
                  className={`${styles.segment} ${active ? styles.segmentActive : ''}`}
                  onClick={() => { if (activeId) setThinkLevel(activeId, value); }}
                >
                  <LevelGlyph bars={bars} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={styles.chip}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Model ${currentModel || 'none'}, ${level.label}`}
        title={`${currentModel || 'No model'} · ${level.label}`}
      >
        <span className={styles.chipModel}>{currentModel ? shortModel(currentModel) : '—'}</span>
        <span className={thinkLevel !== 'off' ? styles.chipModeOn : styles.chipMode}>
          <LevelGlyph bars={level.bars} />
        </span>
        <svg className={`${styles.chevron} ${open ? styles.chevronUp : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
