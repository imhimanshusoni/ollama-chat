import { useState, useRef, useCallback } from 'react';
import { streamChatRaw, hasEmbedModel, DEFAULT_EMBED_MODEL } from '../services/ollama';
import { syncExampleBank, retrieveExamples } from '../services/personaExamples';
import { updatePersonaMemory, isMeaningfulMemory } from '../services/personaMemory';
import {
  detectStyleDirective,
  applyStyleToExamples,
  cleanPersonaReply,
} from '../services/personaStyle';
import { usePersonaStore } from '../store/personaStore';
import { useConnectionStore } from '../store/connectionStore';
import { generateId } from '../utils/generateId';
import type { OllamaMessage } from '../types';

const MAX_HISTORY = 30; // recent persona turns sent each request
const RETRIEVE_K = 8; // example exchanges retrieved per message
const STATIC_FALLBACK = 16; // examples used when retrieval isn't available (no embed model)

// Background memory update shares one controller so a new send cancels an
// in-flight one — on a single-slot Ollama it must not queue ahead of the reply.
let memoryController: AbortController | null = null;

function toWire(examples: OllamaMessage[]): OllamaMessage[] {
  return examples.map((m) => ({ role: m.role, content: m.content }));
}

// Streaming for the persona space: rich profile + retrieved few-shot examples +
// long-term memory. Reply is buffered and revealed whole (no live streaming),
// no tools, no reasoning.
export function usePersonaStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const accRef = useRef('');

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const store = usePersonaStore.getState();
    const { persona, memory } = store;
    const { baseUrl, currentModel, models } = useConnectionStore.getState();
    if (!baseUrl || !currentModel || !persona) return;

    // L1: detect a style directive ("no emoji" etc.) and update persistent
    // style state so it applies this turn and every future one.
    const directive = detectStyleDirective(trimmed);
    if (directive) store.setStyle(directive);
    const style = usePersonaStore.getState().style;

    store.addMessage({ id: generateId(), role: 'user', content: trimmed });
    store.addMessage({ id: generateId(), role: 'assistant', content: '' });

    // A new send cancels a pending background memory update.
    memoryController?.abort();
    memoryController = null;

    const controller = new AbortController();
    controllerRef.current = controller;
    accRef.current = '';
    setIsStreaming(true);

    // Few-shot examples: retrieve the most relevant from the embedded bank; fall
    // back to a static slice when no embedding model is available.
    let exampleMsgs: OllamaMessage[] = toWire(persona.examples.slice(0, STATIC_FALLBACK));
    if (hasEmbedModel(models)) {
      try {
        await syncExampleBank(persona, baseUrl, DEFAULT_EMBED_MODEL);
        const pairs = await retrieveExamples(trimmed, baseUrl, DEFAULT_EMBED_MODEL, RETRIEVE_K, controller.signal);
        if (pairs.length > 0) {
          exampleMsgs = pairs.flatMap((p) => [
            { role: 'user' as const, content: p.user },
            { role: 'assistant' as const, content: p.assistant },
          ]);
        }
      } catch {
        // keep the static fallback
      }
    }

    // L2: make the conditioning consistent with the active style — strip emoji
    // from the injected examples when the user asked for none, so the examples
    // stop contradicting the instruction (the root cause of the wavering).
    exampleMsgs = applyStyleToExamples(exampleMsgs, style);

    const systemContent =
      persona.systemPrompt +
      (isMeaningfulMemory(memory)
        ? `\n\nThings you remember about them (from past chats):\n${memory}`
        : '') +
      (style.emoji ? '' : '\n\nThis person does not want any emojis. Do not use a single emoji.');

    // Exclude the empty assistant placeholder, keep the recent tail.
    const history = usePersonaStore.getState().messages.slice(0, -1).slice(-MAX_HISTORY);
    const wire: OllamaMessage[] = [
      { role: 'system', content: systemContent },
      ...exampleMsgs,
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    let ok = false;
    try {
      for await (const chunk of streamChatRaw(baseUrl, currentModel, wire, [], false, controller.signal)) {
        if (chunk.content) accRef.current += chunk.content;
      }
      // L3: deterministically clean the buffered reply — drop self-correction
      // meta-notes, collapse redrafts, enforce the emoji preference — before it
      // ever reaches the UI.
      usePersonaStore.getState().updateLastMessage(cleanPersonaReply(accRef.current, style) || '…');
      ok = true;
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

    // Update long-term memory in the background (cancelled if a new send starts).
    if (ok && persona.memoryEnabled) {
      memoryController = new AbortController();
      const sig = memoryController.signal;
      const recent = usePersonaStore.getState().messages.slice(-8);
      void updatePersonaMemory(baseUrl, currentModel, usePersonaStore.getState().memory, recent, sig).then(
        (updated) => {
          if (!sig.aborted && updated) usePersonaStore.getState().setMemory(updated);
        }
      );
    }
  }, []);

  const abort = useCallback(() => controllerRef.current?.abort(), []);

  return { send, isStreaming, abort };
}
