import { useConnectionStore } from '../../store/connectionStore';
import { useDocStore } from '../../store/docStore';
import { DEFAULT_EMBED_MODEL, hasEmbedModel } from '../../services/ollama';
import styles from './DocumentsSettings.module.css';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Settings section: embed-model status and the global document library manager.
export function DocumentsSettings() {
  const models = useConnectionStore((s) => s.models);
  const status = useConnectionStore((s) => s.status);
  const documents = useDocStore((s) => s.documents);
  const remove = useDocStore((s) => s.remove);

  const embedReady = hasEmbedModel(models);

  return (
    <section className={styles.section} aria-label="Documents">
      <div className={styles.sectionTitle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {documents.length > 0 && <span className={styles.titleCount}>{documents.length}</span>}
        <span className="visually-hidden">Document library</span>
        {embedReady && (
          <span className={styles.ready} role="img" aria-label="Embedding model ready" title="Embedding model ready">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>

      {status === 'connected' && !embedReady && (
        <p className={styles.notice}>
          Needs an embedding model:
          <code className={styles.code}>ollama pull {DEFAULT_EMBED_MODEL}</code>
        </p>
      )}

      {documents.length > 0 && (
        <ul className={styles.list}>
          {documents.map((d) => (
            <li key={d.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.itemName} title={d.name}>{d.name}</span>
                <span className={styles.itemMeta}>
                  {formatSize(d.bytes)}
                  {d.status === 'ready'
                    ? d.mode === 'inline'
                      ? ' · inline'
                      : ` · ${d.chunkCount ?? 0} chunk${d.chunkCount !== 1 ? 's' : ''}`
                    : ` · ${d.status}`}
                </span>
                {d.status === 'error' && d.error && (
                  <span className={styles.itemError}>{d.error}</span>
                )}
              </div>
              <button
                className={styles.removeBtn}
                type="button"
                onClick={() => void remove(d.id)}
                aria-label={`Delete ${d.name}`}
                title="Delete from library"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
