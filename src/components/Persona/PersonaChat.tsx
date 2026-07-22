import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { useAutoResize } from '../../hooks/useAutoResize';
import { usePersonaStore } from '../../store/personaStore';
import { useUiStore } from '../../store/uiStore';
import { useConnectionStore } from '../../store/connectionStore';
import { usePersonaStream } from '../../hooks/usePersonaStream';
import { usePinToBottom } from '../../hooks/usePinToBottom';
import { hasEmbedModel, DEFAULT_EMBED_MODEL } from '../../services/ollama';
import { syncExampleBank } from '../../services/personaExamples';
import { fetchAsanas, syncAsanaBank } from '../../services/asanaKnowledge';
import { getVoiceSupport } from '../../services/voice/webSpeech';
import { PersonaAvatar } from './PersonaAvatar';
import { PersonaCall } from './PersonaCall';
import styles from './PersonaChat.module.css';

const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function PersonaChat() {
  const persona = usePersonaStore((s) => s.persona);
  const messages = usePersonaStore((s) => s.messages);
  const clear = usePersonaStore((s) => s.clear);
  const load = usePersonaStore((s) => s.load);
  const setPersonaOpen = useUiStore((s) => s.setPersonaOpen);
  const personaCallOpen = useUiStore((s) => s.personaCallOpen);
  const setPersonaCallOpen = useUiStore((s) => s.setPersonaCallOpen);
  const status = useConnectionStore((s) => s.status);
  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const models = useConnectionStore((s) => s.models);
  const { send, isStreaming, abort } = usePersonaStream();

  const [value, setValue] = useState('');
  const [touch] = useState(isTouchDevice);
  const [voiceSupport] = useState(getVoiceSupport);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { resize, reset } = useAutoResize(inputRef);
  // Follow new messages without fighting native touch scrolling. No sticky
  // concept here — always follow, but only when the user isn't scrolling.
  const { pin } = usePinToBottom(scrollRef, () => true);
  const notConnected = status !== 'connected';

  // Refresh the persona config when this space opens (cheap, cache-busted).
  useEffect(() => {
    void load();
  }, [load]);

  // Pre-embed the example bank once connected + an embed model is available, so
  // the first message doesn't pay the embedding cost. No-op without an embed
  // model (retrieval falls back to a static example slice).
  useEffect(() => {
    if (persona && status === 'connected' && hasEmbedModel(models)) {
      void syncExampleBank(persona, baseUrl, DEFAULT_EMBED_MODEL).catch(() => {});
      // Also pre-embed the curated asana knowledge base so the first grounded
      // recommendation doesn't pay the embedding cost. No-op without an embed model.
      void fetchAsanas()
        .then((entries) => {
          if (entries.length > 0) return syncAsanaBank(entries, baseUrl, DEFAULT_EMBED_MODEL);
        })
        .catch(() => {});
    }
  }, [persona, status, models, baseUrl]);

  // Keep pinned to the newest message.
  useEffect(() => {
    pin();
  }, [messages, pin]);

  const name = persona?.name ?? 'Persona';
  const avatar = persona?.avatar ?? '🙂';

  const handleSend = useCallback(() => {
    const text = value.trim();
    // Guard everything send() requires BEFORE clearing the box, so a typed
    // message is never silently lost on an early return.
    if (!text || notConnected || isStreaming || !persona) return;
    void send(text);
    setValue('');
    reset();
  }, [value, notConnected, isStreaming, persona, send, reset]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (touch) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, touch]);

  return (
    <div className={styles.space}>
      <header className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => setPersonaOpen(false)}
          type="button"
          aria-label="Back to chat"
          title="Back to chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <PersonaAvatar avatar={avatar} className={styles.headerAvatar} />
        <div className={styles.headerText}>
          <span className={styles.headerName}>{name}</span>
          <span className={styles.headerStatus}>{isStreaming ? 'typing…' : 'online'}</span>
        </div>
        <div className={styles.headerActions}>
          {voiceSupport.stt && (
            <button
              className={styles.callBtn}
              onClick={() => setPersonaCallOpen(true)}
              type="button"
              disabled={notConnected}
              aria-label={`Call ${name}`}
              title={notConnected ? 'Not connected' : `Call ${name}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          )}
          <button
            className={styles.clearBtn}
            onClick={clear}
            type="button"
            aria-label="Clear chat"
            title="Clear chat"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </header>

      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <PersonaAvatar avatar={avatar} className={styles.emptyAvatar} />
            <div className={styles.emptyName}>{name}</div>
            <div className={styles.emptyHint}>Say hi 👋</div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            const isTyping = !isUser && !m.content && isStreaming;
            return (
              <div key={m.id} className={`${styles.row} ${isUser ? styles.rowUser : styles.rowThem}`}>
                {!isUser && <PersonaAvatar avatar={avatar} className={styles.bubbleAvatar} />}
                <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleThem}`}>
                  {isTyping ? (
                    <span className={styles.dots}><span /><span /><span /></span>
                  ) : (
                    <span className={styles.text}>{m.content}</span>
                  )}
                  {m.error && <span className={styles.error}>couldn't send — {m.error}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.composer}>
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder={notConnected ? 'Not connected…' : `Message ${name}…`}
          rows={1}
          value={value}
          onChange={(e) => { setValue(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          disabled={notConnected}
          enterKeyHint={touch ? 'enter' : 'send'}
        />
        <button
          className={styles.sendBtn}
          onClick={isStreaming ? abort : handleSend}
          type="button"
          disabled={isStreaming ? false : notConnected || !value.trim()}
          aria-label={isStreaming ? 'Stop' : 'Send'}
        >
          {isStreaming ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
          )}
        </button>
      </div>

      {personaCallOpen && persona && (
        <PersonaCall onClose={() => setPersonaCallOpen(false)} />
      )}
    </div>
  );
}
