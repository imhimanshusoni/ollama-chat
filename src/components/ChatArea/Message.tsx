import { memo, useState, useCallback, useEffect, useRef } from 'react';
import type { Message as MessageType, ToolInvocation } from '../../types';
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

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={styles.thinking}>
      <span className={styles.thinkingDot} />
      <span className={styles.thinkingText}>
        Thinking{elapsed > 0 ? `... ${elapsed}s` : '...'}
      </span>
    </span>
  );
}

function formatArgs(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return '';
  return keys
    .map((k) => `${k}: ${typeof args[k] === 'string' ? args[k] : JSON.stringify(args[k])}`)
    .join(', ');
}

function ToolCalls({ calls }: { calls: ToolInvocation[] }) {
  return (
    <div className={styles.toolCalls}>
      {calls.map((call, i) => {
        const running = call.result === undefined;
        const argSummary = formatArgs(call.arguments);
        return (
          <details key={i} className={styles.toolCall}>
            <summary className={styles.toolSummary}>
              <svg
                className={styles.toolIcon}
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span className={styles.toolName}>{call.name}</span>
              {argSummary && <span className={styles.toolArgSummary}>{argSummary}</span>}
              {running && <span className={styles.toolRunning}>running…</span>}
            </summary>
            <div className={styles.toolDetail}>
              {argSummary && (
                <div className={styles.toolBlock}>
                  <span className={styles.toolLabel}>Arguments</span>
                  <pre className={styles.toolPre}>{JSON.stringify(call.arguments, null, 2)}</pre>
                </div>
              )}
              <div className={styles.toolBlock}>
                <span className={styles.toolLabel}>Result</span>
                <pre className={styles.toolPre}>{running ? '…' : call.result}</pre>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function Reasoning({ text, open, streaming }: { text: string; open: boolean; streaming: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // Follow the newest tokens only while the user is at the bottom of the box.
  // Scrolling up inside it disengages; scrolling back down re-engages. Content
  // growth alone never fires scroll events, so this only reacts to the user
  // (and to our own pin-to-bottom, which lands at distance 0 and keeps it on).
  const followRef = useRef(true);

  const handleToggle = useCallback((e: React.SyntheticEvent<HTMLDetailsElement>) => {
    // Keep an expanded reasoning trace in view (manual open, or auto-open while streaming).
    if (e.currentTarget.open) e.currentTarget.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleBodyScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }, []);

  // While reasoning streams, keep the (height-capped) box pinned to the latest
  // tokens so you can watch it think — unless the user scrolled up to read.
  useEffect(() => {
    if (streaming && followRef.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [text, streaming]);

  return (
    <details className={styles.reasoning} open={open} onToggle={handleToggle}>
      <summary className={styles.reasoningSummary}>
        <svg
          className={styles.reasoningChevron}
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className={streaming ? styles.reasoningLive : undefined}>Reasoning</span>
      </summary>
      <div className={styles.reasoningText} ref={bodyRef} onScroll={handleBodyScroll}>
        <MarkdownRenderer content={text} variant="reasoning" />
      </div>
    </details>
  );
}

function MessageInner({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';
  const isWaiting = isStreaming && !message.content;
  const showCopy = !isUser && !isStreaming && message.content;

  return (
    <div className={`${styles.msg} ${isUser ? styles.user : styles.assistant}`}>
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAssistant}`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`${styles.body} msg-body ${isStreaming && message.content ? 'cursor-blink' : ''}`}>
        {message.images && message.images.length > 0 && (
          <div className={styles.msgImages}>
            {message.images.map((img, i) => (
              <img
                key={i}
                src={`data:image/png;base64,${img}`}
                alt="Attached"
                className={styles.msgImage}
              />
            ))}
          </div>
        )}
        {!isUser && message.thinking && (
          <Reasoning
            text={message.thinking}
            open={Boolean(isStreaming) && !message.content}
            streaming={Boolean(isStreaming) && !message.content}
          />
        )}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCalls calls={message.toolCalls} />
        )}
        {isUser ? (
          <span dangerouslySetInnerHTML={{ __html: escapeHtml(message.content).replace(/\n/g, '<br>') }} />
        ) : isWaiting ? (
          <ThinkingIndicator />
        ) : (
          <MarkdownRenderer content={message.content} />
        )}
        {!isUser && message.error && !isStreaming && (
          <div className={styles.msgError}>Request failed: {message.error}</div>
        )}
        {showCopy && <CopyButton content={message.content} />}
      </div>
    </div>
  );
}

export const Message = memo(MessageInner);
