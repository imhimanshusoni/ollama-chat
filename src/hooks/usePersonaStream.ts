import { useState, useRef, useCallback } from 'react';
import { streamChatRaw } from '../services/ollama';
import { usePersonaStore } from '../store/personaStore';
import { useConnectionStore } from '../store/connectionStore';
import { generateId } from '../utils/generateId';
import type { OllamaMessage } from '../types';

// Recent persona turns sent each request. The system prompt and few-shot
// examples are a fixed prefix; capping history keeps the prompt well within the
// context window for a long persona chat.
const MAX_HISTORY = 30;

// Streaming for the persona space. Deliberately minimal — no tools, no RAG, no
// reasoning, no background meta calls. Just: persona system prompt + curated
// few-shot examples + recent history, streamed as plain text.
export function usePersonaStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const accRef = useRef('');

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const store = usePersonaStore.getState();
    const { persona } = store;
    const { baseUrl, currentModel } = useConnectionStore.getState();
    if (!baseUrl || !currentModel || !persona) return;

    store.addMessage({ id: generateId(), role: 'user', content: trimmed });
    store.addMessage({ id: generateId(), role: 'assistant', content: '' });

    const controller = new AbortController();
    controllerRef.current = controller;
    accRef.current = '';
    setIsStreaming(true);

    // Exclude the empty assistant placeholder we just added, then keep the tail.
    const history = usePersonaStore.getState().messages.slice(0, -1).slice(-MAX_HISTORY);
    const wire: OllamaMessage[] = [
      { role: 'system', content: persona.systemPrompt },
      ...persona.examples,
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      // think:false — a real person doesn't show a reasoning trace. gemma4's
      // natural sampling still applies inside streamChatRaw.
      for await (const chunk of streamChatRaw(baseUrl, currentModel, wire, [], false, controller.signal)) {
        if (chunk.content) {
          accRef.current += chunk.content;
          usePersonaStore.getState().updateLastMessage(accRef.current);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        usePersonaStore.getState().removeLastIfEmptyAssistant();
      } else {
        usePersonaStore.getState().updateLastMessage(accRef.current || '…');
        usePersonaStore.getState().setLastMessageError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsStreaming(false);
      controllerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => controllerRef.current?.abort(), []);

  return { send, isStreaming, abort };
}
