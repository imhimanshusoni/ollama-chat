import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message } from '../types';

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  newChat: () => string;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
  addMessage: (id: string, msg: Message) => void;
  updateLastMessage: (id: string, content: string) => void;
  setTitle: (id: string, title: string) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

        setTitle: (id, title) => {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, title } : c
            ),
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
