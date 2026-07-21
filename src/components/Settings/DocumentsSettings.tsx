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
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Documents (RAG)</div>

      {status === 'connected' && !embedReady ? (
        <p className={styles.notice}>
          No embedding model found. To chat with documents, run this on your Ollama server:
          <code className={styles.code}>ollama pull {DEFAULT_EMBED_MODEL}</code>
        </p>
      ) : (
        <p className={styles.hint}>
          {embedReady
            ? `Embedding model ready. Attach documents from the controls next to the message box.`
            : 'Connect to your Ollama server to manage documents.'}
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
    </div>
  );
}
