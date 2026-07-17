import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ContextSummary, Conversation, Message, TokenStats, ToolInvocation } from '../types';
import { generateId } from '../utils/generateId';

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  newChat: () => string;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
  addMessage: (id: string, msg: Message) => void;
  updateLastMessage: (id: string, content: string) => void;
  appendThinking: (id: string, delta: string) => void;
  addToolCall: (id: string, invocation: ToolInvocation) => void;
  setToolResult: (id: string, name: string, result: string) => void;
  setTitle: (id: string, title: string, opts?: { generated?: boolean }) => void;
  setReasoning: (id: string, reasoning: boolean) => void;
  setTokenStats: (id: string, stats: TokenStats) => void;
  setContextSummary: (id: string, summary: ContextSummary) => void;
  setLastMessageError: (id: string, error: string) => void;
  removeLastMessageIfEmptyAssistant: (id: string) => void;
}

function migrateOldData(): { conversations: Conversation[]; activeId: string | null } | null {
  try {
    const rawConvos = localStorage.getItem('ollama_convos');
    const rawActive = localStorage.getItem('ollama_active');
    if (rawConvos) {
      const conversations: Conversation[] = JSON.parse(rawConvos);
      const activeId = rawActive || null;
      localStorage.removeItem('ollama_convos');
      localStorage.removeItem('ollama_active');
      return { conversations, activeId };
    }
  } catch {
    // ignore migration errors
  }
  return null;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => {
      const migrated = migrateOldData();

      return {
        conversations: migrated?.conversations ?? [],
        activeId: migrated?.activeId ?? null,

        newChat: () => {
          const id = generateId();
          const conversation: Conversation = {
            id,
            title: 'New Chat',
            messages: [],
            created: Date.now(),
            reasoning: false,
          };
          set((state) => ({
            conversations: [conversation, ...state.conversations],
            activeId: id,
          }));
          return id;
        },

        switchChat: (id) => {
          set({ activeId: id });
        },

        deleteChat: (id) => {
          set((state) => {
            const remaining = state.conversations.filter((c) => c.id !== id);
            const activeId =
              state.activeId === id
                ? remaining.length > 0
                  ? remaining[0].id
                  : null
                : state.activeId;
            return { conversations: remaining, activeId };
          });
        },

        addMessage: (id, msg) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, messages: [...c.messages, msg] } : c
            ),
          }));
        },

        updateLastMessage: (id, content) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id || c.messages.length === 0) return c;
              const messages = [...c.messages];
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                content,
              };
              return { ...c, messages };
            }),
          }));
        },

        appendThinking: (id, delta) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id || c.messages.length === 0) return c;
              const messages = [...c.messages];
              const last = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...last,
                thinking: (last.thinking ?? '') + delta,
              };
              return { ...c, messages };
            }),
          }));
        },

        addToolCall: (id, invocation) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id || c.messages.length === 0) return c;
              const messages = [...c.messages];
              const last = messages[messages.length - 1];
              messages[messages.length - 1] = {
                ...last,
                toolCalls: [...(last.toolCalls ?? []), invocation],
              };
              return { ...c, messages };
            }),
          }));
        },

        setToolResult: (id, name, result) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id || c.messages.length === 0) return c;
              const messages = [...c.messages];
              const last = messages[messages.length - 1];
              const calls = last.toolCalls;
              if (!calls || calls.length === 0) return c;
              // Fill the most recent pending (result-less) invocation of this tool.
              let idx = -1;
              for (let i = calls.length - 1; i >= 0; i--) {
                if (calls[i].name === name && calls[i].result === undefined) {
                  idx = i;
                  break;
                }
              }
              if (idx === -1) return c;
              const nextCalls = [...calls];
              nextCalls[idx] = { ...nextCalls[idx], result };
              messages[messages.length - 1] = { ...last, toolCalls: nextCalls };
              return { ...c, messages };
            }),
          }));
        },

        setTitle: (id, title, opts) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id) return c;
              // A generated title is written at most once per conversation.
              if (opts?.generated && c.titleGenerated) return c;
              return {
                ...c,
                title,
                ...(opts?.generated ? { titleGenerated: true } : {}),
              };
            }),
          }));
        },

        setReasoning: (id, reasoning) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, reasoning } : c
            ),
          }));
        },

        setTokenStats: (id, stats) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, lastTokenStats: stats } : c
            ),
          }));
        },

        setContextSummary: (id, summary) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, contextSummary: summary } : c
            ),
          }));
        },

        setLastMessageError: (id, error) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id || c.messages.length === 0) return c;
              const messages = [...c.messages];
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                error,
              };
              return { ...c, messages };
            }),
          }));
        },

        // Drops the trailing assistant placeholder if the stream was aborted
        // before it received any content, so an empty bubble isn't persisted.
        removeLastMessageIfEmptyAssistant: (id) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id || c.messages.length === 0) return c;
              const last = c.messages[c.messages.length - 1];
              const isEmpty =
                last.role === 'assistant' &&
                !last.content &&
                !last.thinking &&
                !(last.toolCalls && last.toolCalls.length);
              if (!isEmpty) return c;
              return { ...c, messages: c.messages.slice(0, -1) };
            }),
          }));
        },
      };
    },
    {
      name: 'ollama-chat-store',
      // Strip base64 images before persisting to avoid blowing localStorage limit
      partialize: (state) => ({
        conversations: state.conversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.images ? { ...m, images: undefined } : m
          ),
        })),
        activeId: state.activeId,
      }),
    }
  )
);
