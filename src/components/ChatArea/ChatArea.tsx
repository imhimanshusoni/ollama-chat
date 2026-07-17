import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { MessageList } from './MessageList';
import { EmptyState } from './EmptyState';
import styles from './ChatArea.module.css';

interface Props {
  isStreaming: boolean;
}

export function ChatArea({ isStreaming }: Props) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef(true);
  const prevMsgCountRef = useRef(0);
  const reengageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jumpVisible, setJumpVisible] = useState(false);

  const convo = conversations.find((c) => c.id === activeId);
  const messages = convo?.messages || [];

  // --- Detect USER scroll via wheel/touch/keyboard ---
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const disengage = () => {
      stickyRef.current = false;
      // Cancel any pending re-engage
      if (reengageTimer.current) {
        clearTimeout(reengageTimer.current);
        reengageTimer.current = null;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) disengage();
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - touchStartY;
      if (deltaY > 10) disengage();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['PageUp', 'ArrowUp', 'Home'].includes(e.key)) {
        disengage();
      }
    };

    // Covers scrollbar drags, which emit no wheel/touch/key events. Our own
    // pin-to-bottom lands at distance ~0 so it never self-disengages; content
    // growth alone doesn't fire scroll events.
    const handleScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 150) disengage();
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- Intersection Observer: debounced re-engage when sentinel visible ---
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Debounce: wait 150ms for scroll momentum to settle
          if (!reengageTimer.current) {
            reengageTimer.current = setTimeout(() => {
              stickyRef.current = true;
              setJumpVisible(false);
              reengageTimer.current = null;
            }, 150);
          }
        } else {
          // Sentinel left view — cancel pending re-engage
          if (reengageTimer.current) {
            clearTimeout(reengageTimer.current);
            reengageTimer.current = null;
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(anchor);
    return () => {
      observer.disconnect();
      if (reengageTimer.current) clearTimeout(reengageTimer.current);
    };
  }, []);

  // --- Show jump button when disengaged during streaming (polled) ---
  useEffect(() => {
    if (!isStreaming) {
      setJumpVisible(false);
      return;
    }

    const interval = setInterval(() => {
      const shouldShow = !stickyRef.current && isStreaming;
      setJumpVisible((prev) => (prev !== shouldShow ? shouldShow : prev));
    }, 300);

    return () => clearInterval(interval);
  }, [isStreaming]);

  // --- When new message is sent, always scroll to bottom ---
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      stickyRef.current = true;
      setJumpVisible(false);
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // --- During streaming, auto-scroll only if sticky ---
  // Track both the answer and the reasoning trace so the view follows whichever
  // is currently growing (reasoning streams before any content arrives).
  const lastContent = messages[messages.length - 1]?.content;
  const lastThinking = messages[messages.length - 1]?.thinking;
  useEffect(() => {
    if (isStreaming && stickyRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [lastContent, lastThinking, isStreaming]);

  const handleJump = useCallback(() => {
    stickyRef.current = true;
    setJumpVisible(false);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  return (
    <div className={styles.area} ref={scrollRef}>
      <div className={styles.inner}>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
        <div ref={anchorRef} className={styles.anchor} aria-hidden="true" />
      </div>
      {/* Always in DOM — visibility controlled by CSS opacity for zero layout shift */}
      <button
        className={`${styles.jumpBtn} ${jumpVisible ? styles.jumpVisible : ''}`}
        onClick={handleJump}
        aria-label="Scroll to bottom"
        type="button"
        tabIndex={jumpVisible ? 0 : -1}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
