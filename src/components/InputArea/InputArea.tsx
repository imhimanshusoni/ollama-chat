import { useRef, useState, useCallback, type KeyboardEvent, type ClipboardEvent, type DragEvent } from 'react';
import { useAutoResize } from '../../hooks/useAutoResize';
import { useConnectionStore } from '../../store/connectionStore';
import { useDocStore } from '../../store/docStore';
import { validateImage, prepareImage, fileToBase64, fileToDataUrl } from '../../utils/imageUtils';
import { isSupportedDoc } from '../../utils/docUtils';
import { DEFAULT_EMBED_MODEL } from '../../services/ollama';
import { SendButton } from './SendButton';
import { ComposerControls } from './ComposerControls';
import { DocAttach } from './DocAttach';
import { DocChips } from './DocChips';
import styles from './InputArea.module.css';

interface Props {
  onSend: (text: string, images?: string[], docIds?: string[]) => void;
  onStop: () => void;
  isStreaming: boolean;
}

const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function InputArea({ onSend, onStop, isStreaming }: Props) {
  const [value, setValue] = useState('');
  const [touch] = useState(isTouchDevice);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // Documents staged for the NEXT message. On send they become part of the
  // message (a pill on the bubble) and join the conversation's context set, then
  // clear from here — the composer is never a permanent doc pin.
  const [pendingDocIds, setPendingDocIds] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { resize, reset } = useAutoResize(ref);
  const status = useConnectionStore((s) => s.status);
  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const ingest = useDocStore((s) => s.ingest);
  const documents = useDocStore((s) => s.documents);
  const notConnected = status !== 'connected';

  const addPending = useCallback((id: string) => {
    setPendingDocIds((p) => (p.includes(id) ? p : [...p, id]));
  }, []);
  const removePending = useCallback((id: string) => {
    setPendingDocIds((p) => p.filter((x) => x !== id));
  }, []);

  // Stage a document for the next message: ingest it and add its id to pending
  // as soon as the record exists (so its progress chip shows immediately).
  const attachDoc = useCallback((file: File) => {
    void ingest(file, baseUrl, DEFAULT_EMBED_MODEL, addPending);
  }, [ingest, baseUrl, addPending]);

  const attachImage = useCallback(async (file: File) => {
    const { valid, error } = validateImage(file);
    if (!valid) {
      alert(error);
      return;
    }
    // Converts HEIC to JPEG + resizes if needed
    const prepared = await prepareImage(file);
    const [base64, dataUrl] = await Promise.all([
      fileToBase64(prepared),
      fileToDataUrl(prepared),
    ]);
    setImageBase64(base64);
    setImagePreview(dataUrl);
  }, []);

  const removeImage = useCallback(() => {
    setImageBase64(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  // Block send while a staged doc is still ingesting, so the first answer isn't
  // generated before its content is available (matches Claude's upload gating).
  const pendingBusy = pendingDocIds.some((id) => {
    const d = documents.find((doc) => doc.id === id);
    return d ? d.status !== 'ready' && d.status !== 'error' : false;
  });

  const handleSend = useCallback(() => {
    const text = value.trim();
    if ((!text && !imageBase64) || notConnected || isStreaming || pendingBusy) return;
    onSend(
      text || 'What is in this image?',
      imageBase64 ? [imageBase64] : undefined,
      pendingDocIds.length ? pendingDocIds : undefined
    );
    setValue('');
    removeImage();
    setPendingDocIds([]);
    reset();
  }, [value, imageBase64, notConnected, isStreaming, pendingBusy, pendingDocIds, onSend, removeImage, reset]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // On touch devices there's no easy Shift key, so Enter inserts a
    // newline like the on-screen keyboard implies; users tap Send instead.
    if (touch) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, touch]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachImage(file);
  }, [attachImage]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) attachImage(file);
        return;
      }
    }
  }, [attachImage]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files) return;
    for (const file of files) {
      if (file.type.startsWith('image/')) attachImage(file);
      else if (isSupportedDoc(file)) attachDoc(file);
    }
  }, [attachImage, attachDoc]);

  return (
    <div
      className={styles.area}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DocChips pendingDocIds={pendingDocIds} onRemove={removePending} />
      {imagePreview && (
        <div className={styles.previewRow}>
          <div className={styles.preview}>
            <img src={imagePreview} alt="Attached" className={styles.previewImg} />
            <button
              className={styles.previewRemove}
              onClick={removeImage}
              type="button"
              aria-label="Remove image"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className={`${styles.wrap} ${dragOver ? styles.dragOver : ''}`}>
        <DocAttach pendingDocIds={pendingDocIds} onAdd={addPending} onRemove={removePending} />
        <button
          className={styles.attachBtn}
          onClick={() => fileRef.current?.click()}
          type="button"
          disabled={notConnected}
          aria-label="Attach image"
          title="Attach image"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={handleFileChange}
          className={styles.fileInput}
          tabIndex={-1}
        />
        <textarea
          ref={ref}
          className={styles.input}
          placeholder={imageBase64 ? 'Add a message or just send the image...' : 'Message Ollama...'}
          rows={1}
          value={value}
          onChange={(e) => { setValue(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={notConnected}
          enterKeyHint={touch ? 'enter' : 'send'}
        />
        <SendButton
          isStreaming={isStreaming}
          disabled={isStreaming ? false : notConnected || pendingBusy || (!value.trim() && !imageBase64)}
          onClick={isStreaming ? onStop : handleSend}
        />
      </div>
      <div className={styles.footerRow}>
        <ComposerControls />
        <div className={styles.hint}>
          {touch ? 'Tap send to send · Enter for new line' : 'Enter to send · Shift+Enter for new line'}
        </div>
      </div>
    </div>
  );
}
