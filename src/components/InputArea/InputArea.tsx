import { useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { useAutoResize } from '../../hooks/useAutoResize';
import { useConnectionStore } from '../../store/connectionStore';
import { SendButton } from './SendButton';
import styles from './InputArea.module.css';

interface Props {
  onSend: (text: string) => void;
  isStreaming: boolean;
}

export function InputArea({ onSend, isStreaming }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const { resize, reset } = useAutoResize(ref);
  const status = useConnectionStore((s) => s.status);
  const disabled = status !== 'connected' || isStreaming;

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    reset();
  }, [value, disabled, onSend, reset]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className={styles.area}>
      <div className={styles.wrap}>
        <textarea
          ref={ref}
          className={styles.input}
          placeholder="Message Ollama..."
          rows={1}
          value={value}
          onChange={(e) => { setValue(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <SendButton disabled={disabled || !value.trim()} onClick={handleSend} />
      </div>
      <div className={styles.hint}>Enter to send &middot; Shift+Enter for new line</div>
    </div>
  );
}
