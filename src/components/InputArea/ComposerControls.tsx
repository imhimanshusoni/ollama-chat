import { useRef, useState, useCallback } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useUiStore } from '../../store/uiStore';
import { warmModel } from '../../services/ollama';
import { useClickOutside } from '../../hooks/useClickOutside';
import { Toggle } from '../ui/Toggle';
import styles from './ComposerControls.module.css';

// Strip the tag suffix for a compact chip label: "gemma4:12b-it-q4_K_M" -> "gemma4".
function shortModel(name: string): string {
  return name.split(':')[0] || name;
}

export function ComposerControls() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close);

  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const models = useConnectionStore((s) => s.models);
  const currentModel = useConnectionStore((s) => s.currentModel);
  const setCurrentModel = useConnectionStore((s) => s.setCurrentModel);
  const reasoning = useUiStore((s) => s.reasoning);
  const setReasoning = useUiStore((s) => s.setReasoning);

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

          <div className={styles.reasoningRow}>
            <div className={styles.reasoningText}>
              <span className={styles.reasoningTitle}>Reasoning</span>
              <span className={styles.reasoningHint}>Thinks first. Slower, more thorough.</span>
            </div>
            <Toggle checked={reasoning} onChange={setReasoning} label="Toggle reasoning" />
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
        <span className={reasoning ? styles.chipModeOn : styles.chipMode}>
          {reasoning ? 'Reasoning' : 'Fast'}
        </span>
        <svg className={`${styles.chevron} ${open ? styles.chevronUp : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
