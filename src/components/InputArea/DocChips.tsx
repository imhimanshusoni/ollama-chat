import { useDocStore } from '../../store/docStore';
import styles from './DocChips.module.css';

interface Props {
  pendingDocIds: string[]; // docs staged for the next message
  onRemove: (id: string) => void;
}

// Chips above the composer for documents staged for the NEXT message, with live
// ingestion progress. They clear on send (the doc then shows on the message
// bubble and lives in the conversation's context) — this is not a permanent pin.
export function DocChips({ pendingDocIds, onRemove }: Props) {
  const documents = useDocStore((s) => s.documents);
  const progress = useDocStore((s) => s.progress);

  if (pendingDocIds.length === 0) return null;

  const pending = pendingDocIds
    .map((id) => documents.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  if (pending.length === 0) return null;

  return (
    <div className={styles.row}>
      {pending.map((doc) => {
        const prog = progress[doc.id];
        const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
        const busy = doc.status !== 'ready' && doc.status !== 'error';
        const isError = doc.status === 'error';
        return (
          <div
            key={doc.id}
            className={`${styles.chip} ${isError ? styles.chipError : ''}`}
            title={isError ? doc.error : doc.name}
          >
            <svg className={styles.fileIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className={styles.name}>{doc.name}</span>
            {busy && (
              <span className={styles.status}>
                {doc.status === 'embedding' && prog ? `${pct}%` : doc.status}
              </span>
            )}
            {isError && <span className={styles.status}>failed</span>}
            <button
              className={styles.remove}
              type="button"
              aria-label={`Remove ${doc.name}`}
              title="Remove"
              onClick={() => onRemove(doc.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {busy && (
              <span className={styles.bar}>
                <span className={styles.barFill} style={{ width: `${pct}%` }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
