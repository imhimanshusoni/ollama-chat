import { useRef, useState, useCallback, type KeyboardEvent, type ClipboardEvent, type DragEvent } from 'react';
import { useAutoResize } from '../../hooks/useAutoResize';
import { useConnectionStore } from '../../store/connectionStore';
import { useDocStore } from '../../store/docStore';
import { validateImage, prepareImage, fileToBase64, fileToDataUrl } from '../../utils/imageUtils';
import { isSupportedDoc } from '../../utils/docUtils';
import { DEFAULT_EMBED_MODEL } from '../../services/ollama';
import { SendButton } from './SendButton';
import { ComposerControls } from './ComposerControls';
import { AttachMenu } from './AttachMenu';
import { DocChips } from './DocChips';
import styles from './InputArea.module.css';

interface Props {
  onSend: (text: string, images?: string[], docIds?: string[]) => void;
  onStop: () => void;
  isStreaming: boolean;
}

// Standard cap on images per message.
const MAX_IMAGES = 5;

interface AttachedImage {
  base64: string; // sent to the model (no data-URI prefix)
  dataUrl: string; // for the local preview thumbnail
}

const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function InputArea({ onSend, onStop, isStreaming }: Props) {
  const [value, setValue] = useState('');
  const [touch] = useState(isTouchDevice);
  const [images, setImages] = useState<AttachedImage[]>([]);
  // Documents staged for the NEXT message. On send they join the conversation's
  // context and clear from here (they show as a pill on the message).
  const [pendingDocIds, setPendingDocIds] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { resize, reset } = useAutoResize(ref);
  const status = useConnectionStore((s) => s.status);
  const baseUrl = useConnectionStore((s) => s.baseUrl);
  const ingest = useDocStore((s) => s.ingest);
  const notConnected = status !== 'connected';

  const addPending = useCallback((id: string) => {
    setPendingDocIds((p) => (p.includes(id) ? p : [...p, id]));
  }, []);
  const removePending = useCallback((id: string) => {
    setPendingDocIds((p) => p.filter((x) => x !== id));
  }, []);

  const attachDoc = useCallback((file: File) => {
    void ingest(file, baseUrl, DEFAULT_EMBED_MODEL, addPending);
  }, [ingest, baseUrl, addPending]);

  // Validate/convert/resize a batch of image files, then append up to the cap.
  const attachImages = useCallback(async (files: File[]) => {
    const prepared: AttachedImage[] = [];
    for (const file of files) {
      const { valid, error } = validateImage(file);
      if (!valid) {
        alert(error);
        continue;
      }
      const p = await prepareImage(file); // HEIC→JPEG + resize
      const [base64, dataUrl] = await Promise.all([fileToBase64(p), fileToDataUrl(p)]);
      prepared.push({ base64, dataUrl });
    }
    if (prepared.length === 0) return;
    setImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) {
        alert(`You can attach up to ${MAX_IMAGES} images.`);
        return prev;
      }
      if (prepared.length > room) {
        alert(`Only ${room} more image${room !== 1 ? 's' : ''} can be attached (max ${MAX_IMAGES}).`);
      }
      return [...prev, ...prepared.slice(0, room)];
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if ((!text && images.length === 0) || notConnected || isStreaming) return;
    onSend(
      text || 'What is in this image?',
      images.length ? images.map((i) => i.base64) : undefined,
      pendingDocIds.length ? pendingDocIds : undefined
    );
    setValue('');
    setImages([]);
    setPendingDocIds([]);
    reset();
  }, [value, images, notConnected, isStreaming, pendingDocIds, onSend, reset]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // On touch devices there's no easy Shift key, so Enter inserts a
    // newline like the on-screen keyboard implies; users tap Send instead.
    if (touch) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, touch]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) {
      e.preventDefault();
      void attachImages(imageFiles);
    }
  }, [attachImages]);

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
    const imageFiles: File[] = [];
    for (const file of files) {
      if (file.type.startsWith('image/')) imageFiles.push(file);
      else if (isSupportedDoc(file)) attachDoc(file);
    }
    if (imageFiles.length) void attachImages(imageFiles);
  }, [attachImages, attachDoc]);

  return (
    <div
      className={styles.area}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DocChips pendingDocIds={pendingDocIds} onRemove={removePending} />
      {images.length > 0 && (
        <div className={styles.previewRow}>
          {images.map((img, i) => (
            <div key={i} className={styles.preview}>
              <img src={img.dataUrl} alt="Attached" className={styles.previewImg} />
              <button
                className={styles.previewRemove}
                onClick={() => removeImage(i)}
                type="button"
                aria-label="Remove image"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`${styles.wrap} ${dragOver ? styles.dragOver : ''}`}>
        <AttachMenu
          pendingDocIds={pendingDocIds}
          onAddDoc={addPending}
          onImageFiles={attachImages}
          imagesRemaining={MAX_IMAGES - images.length}
        />
        <textarea
          ref={ref}
          className={styles.input}
          placeholder={images.length ? 'Add a message or just send the image...' : 'Message Ollama...'}
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
          disabled={isStreaming ? false : notConnected || (!value.trim() && images.length === 0)}
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
