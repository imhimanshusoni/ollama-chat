import { useMemo, useCallback } from 'react';
import hljs from 'highlight.js';
import styles from './CodeBlock.module.css';

interface Props {
  language: string;
  children: string;
}

export function CodeBlock({ language, children }: Props) {
  const highlighted = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(children, { language }).value;
    }
    return hljs.highlightAuto(children).value;
  }, [children, language]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      const btn = document.activeElement as HTMLButtonElement;
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 1500);
      }
    });
  }, [children]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span>{language || 'code'}</span>
        <button className={styles.copyBtn} onClick={handleCopy} type="button">
          Copy
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
