import { memo, useState, useCallback } from 'react';
import type { Message as MessageType } from '../../types';
import { MarkdownRenderer } from '../Markdown/MarkdownRenderer';
import { escapeHtml } from '../../utils/escapeHtml';
import styles from './Message.module.css';

interface Props {
  message: MessageType;
  isStreaming?: boolean;
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  return (
    <button
      className={styles.copyBtn}
      onClick={handleCopy}
      type="button"
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function MessageInner({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';
  const showCopy = !isUser && !isStreaming && message.content;

  return (
    <div className={`${styles.msg} ${isUser ? styles.user : styles.assistant}`}>
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAssistant}`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`${styles.body} msg-body ${isStreaming ? 'cursor-blink' : ''}`}>
        {isUser ? (
          <span dangerouslySetInnerHTML={{ __html: escapeHtml(message.content).replace(/\n/g, '<br>') }} />
        ) : (
          <MarkdownRenderer content={message.content || '*Thinking...*'} />
        )}
        {showCopy && <CopyButton content={message.content} />}
      </div>
    </div>
  );
}

export const Message = memo(MessageInner);
