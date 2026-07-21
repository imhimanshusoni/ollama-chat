import { useRef, useState, useCallback } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useDocStore } from '../../store/docStore';
import { useClickOutside } from '../../hooks/useClickOutside';
import { DEFAULT_EMBED_MODEL, hasEmbedModel } from '../../services/ollama';
import styles from './AttachMenu.module.css';

interface Props {
  pendingDocIds: string[]; // staged for the next message (drives the badge)
  onAddDoc: (id: string) => void;
  onImageFiles: (files: File[]) => void;
  imagesRemaining: number; // how many more images may still be added
}

// The single composer attachment control: one button opening a menu to attach
// images or documents (PDF/text/markdown).
export function AttachMenu({ pendingDocIds, onAddDoc, onImageFiles, imagesRemaining }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close);

  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const models = useConnectionStore((s) => s.models);
  const status = useConnectionStore((s) => s.status);
  const ingest = useDocStore((s) => s.ingest);

  const embedReady = hasEmbedModel(models);
  const notConnected = status !== 'connected';
  const badge = pendingDocIds.length;

  const handleImageInput = useCallback(
    (files: FileList | null) => {
      if (files && files.length) onImageFiles(Array.from(files));
      if (imageInputRef.current) imageInputRef.current.value = '';
      setOpen(false);
    },
    [onImageFiles]
  );

  const handleDocInput = useCallback(
    (files: FileList | null) => {
      if (files) {
        for (const file of files) void ingest(file, baseUrl, DEFAULT_EMBED_MODEL, onAddDoc);
      }
      if (docInputRef.current) docInputRef.current.value = '';
      setOpen(false);
    },
    [ingest, baseUrl, onAddDoc]
  );

  return (
    <div className={styles.root} ref={rootRef}>
      {open && (
        <div className={styles.popover} role="menu">
          <button
            type="button"
            className={styles.menuItem}
            disabled={notConnected || imagesRemaining <= 0}
            onClick={() => imageInputRef.current?.click()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className={styles.menuLabel}>Photos</span>
            {imagesRemaining <= 0 && <span className={styles.menuHint}>max reached</span>}
          </button>

          <button
            type="button"
            className={styles.menuItem}
            disabled={notConnected}
            onClick={() => docInputRef.current?.click()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className={styles.menuLabel}>Document</span>
            <span className={styles.menuHint}>PDF, text, markdown</span>
          </button>

          {!embedReady && (
            <p className={styles.notice}>
              Small files work as-is. Large files need an embedding model:
              <code className={styles.code}>ollama pull {DEFAULT_EMBED_MODEL}</code>
            </p>
          )}
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        onChange={(e) => handleImageInput(e.target.files)}
        className={styles.fileInput}
        tabIndex={-1}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        multiple
        onChange={(e) => handleDocInput(e.target.files)}
        className={styles.fileInput}
        tabIndex={-1}
      />
      <button
        type="button"
        className={`${styles.attachBtn} ${badge > 0 ? styles.attachBtnActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={notConnected}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Attach files"
        title="Attach images or documents"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        {badge > 0 && <span className={styles.badge}>{badge}</span>}
      </button>
    </div>
  );
}
