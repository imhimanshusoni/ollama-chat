import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ContextSummary, Conversation, Message, ThinkLevel, TokenStats, ToolInvocation } from '../types';
import { generateId } from '../utils/generateId';

// Messages persisted before ids existed (store version 0) get one assigned.
// Shared by the persist migrate step and the legacy-key migration below.
function ensureMessageIds(conversations: Conversation[]): Conversation[] {
  return conversations.map((c) => ({
    ...c,
    messages: c.messages.map((m) => (m.id ? m : { ...m, id: generateId() })),
  }));
}

// Conversations persisted before thinking levels existed carried a boolean
// `reasoning`. Map it to the new `thinkLevel` so prior behavior is preserved:
// a chat with reasoning on → 'medium', everything else → 'off'.
function ensureThinkLevel(conversations: Conversation[]): Conversation[] {
  return conversations.map((c) => {
    if (c.thinkLevel) return c;
    const legacy = (c as { reasoning?: boolean }).reasoning;
    const next = { ...c, thinkLevel: (legacy ? 'medium' : 'off') as ThinkLevel };
    delete (next as { reasoning?: boolean }).reasoning;
    return next;
  });
}

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
  renameChat: (id: string, title: string) => void;
  truncateFrom: (id: string, messageId: string) => void;
  setThinkLevel: (id: string, level: ThinkLevel) => void;
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
      const conversations: Conversation[] = ensureThinkLevel(ensureMessageIds(JSON.parse(rawConvos)));
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
            thinkLevel: 'medium',
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

        // Manual rename. Unlike setTitle, always wins: it also marks the
        // title as generated so the background auto-titler never overwrites
        // a name the user chose.
        renameChat: (id, title) => {
          const trimmed = title.trim();
          if (!trimmed) return;
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, title: trimmed, titleGenerated: true } : c
            ),
          }));
        },

        // Drop messageId and everything after it (regenerate / edit-and-resend).
        // Derived state that assumes append-only messages is repaired: a
        // summary or token-stats checkpoint past the new end is discarded.
        truncateFrom: (id, messageId) => {
          set((state) => ({
            conversations: state.conversations.map((c) => {
              if (c.id !== id) return c;
              const idx = c.messages.findIndex((m) => m.id === messageId);
              if (idx === -1) return c;
              const messages = c.messages.slice(0, idx);
              const next: Conversation = { ...c, messages };
              if (next.contextSummary && next.contextSummary.upToIndex > messages.length) {
                delete next.contextSummary;
              }
              if (next.lastTokenStats && next.lastTokenStats.atMessageCount > messages.length) {
                delete next.lastTokenStats;
              }
              return next;
            }),
          }));
        },

        setThinkLevel: (id, level) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, thinkLevel: level } : c
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
      version: 2,
      // v0 → v1: messages gained a stable `id`.
      // v1 → v2: per-chat boolean `reasoning` became `thinkLevel`.
      // Both transforms are idempotent, so running them unconditionally covers
      // any prior version.
      migrate: (persisted) => {
        const state = persisted as { conversations?: Conversation[]; activeId?: string | null };
        if (state?.conversations) {
          state.conversations = ensureThinkLevel(ensureMessageIds(state.conversations));
        }
        return state;
      },
      // A full localStorage (QuotaExceededError) must not crash a state
      // update — keep the app running on in-memory state and just warn.
      storage: createJSONStorage(() => ({
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (err) {
            console.warn('[chatStore] persist failed (storage quota?)', err);
          }
        },
        removeItem: (key) => localStorage.removeItem(key),
      })),
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
