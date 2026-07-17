import { useState, useRef, useCallback } from 'react';
import { buildContext, spanToSummarize } from '../services/contextWindow';
import { streamChatWithTools } from '../services/ollamaTools';
import { buildSystemPrompt } from '../services/prompts';
import { summarizeSpan } from '../services/summarizer';
import { generateChatTitle } from '../services/titleGenerator';
import { useChatStore } from '../store/chatStore';
import { useConnectionStore } from '../store/connectionStore';
import { useSettingsStore } from '../store/settingsStore';

// Background meta calls (title, summary) share one controller so a new send
// can abort them — on a single-slot Ollama instance they'd otherwise queue
// ahead of the user's message and evict the chat's KV prompt cache.
let metaController: AbortController | null = null;

// After a completed exchange, summarize the first user/assistant pair into a
// real title in the background — once per chat (titleGenerated). Not gated on
// an exact message count, so a failed or aborted first exchange just retries
// after the next completed one. Fire-and-forget: on any failure the
// truncated-first-message fallback title simply stays.
function maybeGenerateTitle(chatId: string, baseUrl: string, model: string, signal: AbortSignal) {
  const conv = useChatStore.getState().conversations.find((c) => c.id === chatId);
  if (!conv || conv.titleGenerated) return;
  const userMsg = conv.messages.find((m) => m.role === 'user');
  const assistantMsg = conv.messages.find((m) => m.role === 'assistant' && m.content);
  if (!userMsg || !assistantMsg) return;

  const titleAtSend = conv.title;
  void generateChatTitle(baseUrl, model, userMsg.content, assistantMsg.content, signal).then((title) => {
    if (!title) return;
    const now = useChatStore.getState().conversations.find((c) => c.id === chatId);
    // Skip if the chat is gone, already titled, or the title changed meanwhile.
    if (!now || now.titleGenerated || now.title !== titleAtSend) return;
    useChatStore.getState().setTitle(chatId, title, { generated: true });
  });
}

// If the next turn is likely to push the prompt over budget, fold the span
// that would be evicted into the rolling summary now, in the background, so
// the next send doesn't lose it. Fire-and-forget; on failure the checkpoint
// stays put and the next send degrades to a plain sliding window.
function maybeSummarize(chatId: string, baseUrl: string, model: string, systemPrompt: string, signal: AbortSignal) {
  const conv = useChatStore.getState().conversations.find((c) => c.id === chatId);
  if (!conv) return;
  const span = spanToSummarize(conv, conv.messages, systemPrompt);
  if (!span) return;

  const checkpointAtSend = conv.contextSummary?.upToIndex ?? 0;
  void summarizeSpan(
    baseUrl,
    model,
    conv.contextSummary?.text,
    conv.messages.slice(span.from, span.to),
    signal
  ).then((text) => {
    if (!text) return;
    const now = useChatStore.getState().conversations.find((c) => c.id === chatId);
    // Skip if the chat is gone or another summary landed meanwhile.
    if (!now || (now.contextSummary?.upToIndex ?? 0) !== checkpointAtSend) return;
    useChatStore.getState().setContextSummary(chatId, { upToIndex: span.to, text });
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

    // A new send takes priority over any in-flight background meta calls.
    metaController?.abort();
    metaController = null;

    // Prepare streaming
    const controller = new AbortController();
    controllerRef.current = controller;
    accumulatedRef.current = '';
    setIsStreaming(true);

    let completed = false;
    const { systemPromptOverride } = useSettingsStore.getState();
    // For token estimation in the context window (assume tools active).
    const systemPromptText = buildSystemPrompt(systemPromptOverride, true);

    try {
      const conv = useChatStore.getState().conversations.find(c => c.id === activeId);
      const messages = conv?.messages ?? [];

      // Exclude the empty assistant message we just added, then fit the
      // history to the prompt budget (window + rolling summary).
      const { history, summaryText } = buildContext(
        conv ?? {},
        messages.slice(0, -1),
        systemPromptText
      );

      for await (const ev of streamChatWithTools(baseUrl, currentModel, history, reasoning, controller.signal, {
        systemPromptOverride,
        contextSummary: summaryText,
      })) {
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
      } else {
        const fallback = accumulatedRef.current || '*Could not get a response.*';
        updateLastMessage(activeId, fallback);
        setLastMessageError(activeId, err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsStreaming(false);
      controllerRef.current = null;
      if (completed) {
        metaController = new AbortController();
        maybeGenerateTitle(activeId, baseUrl, currentModel, metaController.signal);
        maybeSummarize(activeId, baseUrl, currentModel, systemPromptText, metaController.signal);
      }
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { send, isStreaming, abort };
}
