import { useMemo, useCallback, useState } from 'react';
import hljs from 'highlight.js';
import styles from './CodeBlock.module.css';

interface Props {
  language: string;
  children: string;
}

export function CodeBlock({ language, children }: Props) {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(children, { language }).value;
    }
    return hljs.highlightAuto(children).value;
  }, [children, language]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [children]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span>{language || 'code'}</span>
        <button
          className={styles.copyBtn}
          onClick={handleCopy}
          type="button"
          aria-label={copied ? 'Copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy'}
        >
          {copied ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <pre>
        <code
          className="hljs"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}
