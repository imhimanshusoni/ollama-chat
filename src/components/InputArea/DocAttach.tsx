import { useRef, useState, useCallback } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import { useChatStore } from '../../store/chatStore';
import { useDocStore } from '../../store/docStore';
import { useClickOutside } from '../../hooks/useClickOutside';
import { DEFAULT_EMBED_MODEL, hasEmbedModel } from '../../services/ollama';
import styles from './DocAttach.module.css';

// Stable empty reference so the selector doesn't return a new array each render.
const EMPTY_IDS: string[] = [];

interface Props {
  pendingDocIds: string[]; // staged for the next message
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

// Composer control for documents: upload a new file (PDF/text/markdown) or
// re-attach one already in the library to the next message.
export function DocAttach({ pendingDocIds, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close);

  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const models = useConnectionStore((s) => s.models);
  const status = useConnectionStore((s) => s.status);

  // Docs already committed to this conversation (injected every turn already).
  const committed =
    useChatStore((s) => s.conversations.find((c) => c.id === s.activeId)?.docIds) ?? EMPTY_IDS;

  const documents = useDocStore((s) => s.documents);
  const ingest = useDocStore((s) => s.ingest);

  const embedReady = hasEmbedModel(models);
  const notConnected = status !== 'connected';
  const badge = pendingDocIds.length;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (const file of files) {
        void ingest(file, baseUrl, DEFAULT_EMBED_MODEL, onAdd);
      }
      if (fileRef.current) fileRef.current.value = '';
    },
    [ingest, baseUrl, onAdd]
  );

  // Library docs the user could re-attach (exclude ones already in this chat).
  const library = documents.filter((d) => !committed.includes(d.id));

  return (
    <div className={styles.root} ref={rootRef}>
      {open && (
        <div className={styles.popover} role="menu">
          <div className={styles.sectionLabel}>Attach a document</div>

          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => fileRef.current?.click()}
            disabled={notConnected}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload PDF, text or markdown
          </button>

          {!embedReady && (
            <p className={styles.notice}>
              Small files work as-is. Large files need an embedding model:
              <code className={styles.code}>ollama pull {DEFAULT_EMBED_MODEL}</code>
            </p>
          )}

          {library.length > 0 && (
            <>
              <div className={styles.sectionLabel}>From your library</div>
              <ul className={styles.docList}>
                {library.map((d) => {
                  const staged = pendingDocIds.includes(d.id);
                  return (
                    <li key={d.id}>
                      <label className={styles.docItem}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={staged}
                          onChange={(e) => (e.target.checked ? onAdd(d.id) : onRemove(d.id))}
                        />
                        <span className={styles.docName} title={d.name}>{d.name}</span>
                        {d.status !== 'ready' && (
                          <span className={styles.docStatus}>
                            {d.status === 'error' ? 'error' : d.status}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {committed.length > 0 && (
            <p className={styles.empty}>
              {committed.length} document{committed.length !== 1 ? 's' : ''} already in this chat.
            </p>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className={styles.fileInput}
        tabIndex={-1}
      />
      <button
        type="button"
        className={`${styles.docBtn} ${badge > 0 ? styles.docBtnActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Attach documents"
        title="Attach a document"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
        {badge > 0 && <span className={styles.badge}>{badge}</span>}
      </button>
    </div>
  );
}
