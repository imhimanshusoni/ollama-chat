import { useState, useRef, useCallback } from 'react';
import { streamChatWithTools } from '../services/ollamaTools';
import { generateChatTitle } from '../services/titleGenerator';
import { useChatStore } from '../store/chatStore';
import { useConnectionStore } from '../store/connectionStore';

// After the first exchange completes, summarize it into a real title in the
// background. Fire-and-forget: on any failure the truncated-first-message
// fallback title simply stays.
function maybeGenerateTitle(chatId: string, baseUrl: string, model: string) {
  const conv = useChatStore.getState().conversations.find((c) => c.id === chatId);
  if (!conv || conv.titleGenerated || conv.messages.length !== 2) return;
  const [userMsg, assistantMsg] = conv.messages;
  if (assistantMsg.role !== 'assistant' || !assistantMsg.content) return;

  const titleAtSend = conv.title;
  void generateChatTitle(baseUrl, model, userMsg.content, assistantMsg.content).then((title) => {
    if (!title) return;
    const now = useChatStore.getState().conversations.find((c) => c.id === chatId);
    // Skip if the chat is gone, already titled, or the title changed meanwhile.
    if (!now || now.titleGenerated || now.title !== titleAtSend) return;
    useChatStore.getState().setTitle(chatId, title, { generated: true });
  });
}

export function useStreamResponse() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const accumulatedRef = useRef('');

  const send = useCallback(async (text: string, images?: string[]) => {
    const {
      activeId,
      conversations,
      addMessage,
      updateLastMessage,
      appendThinking,
      addToolCall,
      setToolResult,
      setTitle,
      setTokenStats,
      setLastMessageError,
      removeLastMessageIfEmptyAssistant,
    } = useChatStore.getState();
    const { baseUrl, currentModel } = useConnectionStore.getState();

    if (!activeId || !baseUrl || !currentModel) return;

    // Reasoning is stored per-conversation.
    const reasoning = conversations.find((c) => c.id === activeId)?.reasoning ?? false;

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

    let completed = false;
    try {
      const messages = useChatStore.getState().conversations
        .find(c => c.id === activeId)?.messages ?? [];

      // Exclude the empty assistant message we just added
      const messagesToSend = messages.slice(0, -1);

      for await (const ev of streamChatWithTools(baseUrl, currentModel, messagesToSend, reasoning, controller.signal)) {
        if (ev.type === 'reset') {
          accumulatedRef.current = '';
          updateLastMessage(activeId, '');
        } else if (ev.type === 'thinking') {
          appendThinking(activeId, ev.value);
        } else if (ev.type === 'tool_call') {
          addToolCall(activeId, { name: ev.name, arguments: ev.arguments });
        } else if (ev.type === 'tool_result') {
          setToolResult(activeId, ev.name, ev.result);
        } else if (ev.type === 'stats') {
          const msgCount = useChatStore.getState().conversations
            .find(c => c.id === activeId)?.messages.length ?? 0;
          setTokenStats(activeId, {
            promptEvalCount: ev.promptEvalCount,
            evalCount: ev.evalCount,
            atMessageCount: msgCount,
          });
        } else {
          accumulatedRef.current += ev.value;
          updateLastMessage(activeId, accumulatedRef.current);
        }
      }
      completed = true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Aborted before any token arrived → drop the empty placeholder so it
        // isn't persisted (and later sent to the model as an empty turn).
        removeLastMessageIfEmptyAssistant(activeId);
      } else if (err instanceof Error) {
        const fallback = accumulatedRef.current || '*Could not get a response.*';
        updateLastMessage(activeId, fallback);
        setLastMessageError(activeId, err.message);
      }
    } finally {
      setIsStreaming(false);
      controllerRef.current = null;
      if (completed) {
        maybeGenerateTitle(activeId, baseUrl, currentModel);
      }
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { send, isStreaming, abort };
}
