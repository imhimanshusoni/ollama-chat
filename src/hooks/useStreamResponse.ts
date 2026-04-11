import { useState, useRef, useCallback } from 'react';
import { streamChat } from '../services/ollama';
import { useChatStore } from '../store/chatStore';
import { useConnectionStore } from '../store/connectionStore';

export function useStreamResponse() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const accumulatedRef = useRef('');

  const send = useCallback(async (text: string, images?: string[]) => {
    const { activeId, addMessage, updateLastMessage, setTitle } = useChatStore.getState();
    const { baseUrl, currentModel } = useConnectionStore.getState();

    if (!activeId || !baseUrl || !currentModel) return;

    // Add user message (with optional images)
    addMessage(activeId, { role: 'user', content: text, ...(images ? { images } : {}) });

    // Set title from first message if empty
    const conversation = useChatStore.getState().conversations.find(c => c.id === activeId);
    if (conversation && (!conversation.title || conversation.title === 'New Chat')) {
      const title = text.slice(0, 60) + (text.length > 60 ? '...' : '');
      setTitle(activeId, title);
    }

    // Add empty assistant message
    addMessage(activeId, { role: 'assistant', content: '' });

    // Prepare streaming
    const controller = new AbortController();
    controllerRef.current = controller;
    accumulatedRef.current = '';
    setIsStreaming(true);

    try {
      const messages = useChatStore.getState().conversations
        .find(c => c.id === activeId)?.messages ?? [];

      // Exclude the empty assistant message we just added
      const messagesToSend = messages.slice(0, -1);

      for await (const token of streamChat(baseUrl, currentModel, messagesToSend, controller.signal)) {
        accumulatedRef.current += token;
        updateLastMessage(activeId, accumulatedRef.current);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const fallback = accumulatedRef.current || '*Could not get a response.*';
        updateLastMessage(activeId, fallback);
      }
    } finally {
      setIsStreaming(false);
      controllerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { send, isStreaming, abort };
}
