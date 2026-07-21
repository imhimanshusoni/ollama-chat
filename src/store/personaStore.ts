import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../types';
import type { Persona } from '../services/persona';
import { fetchPersona } from '../services/persona';
import { DEFAULT_STYLE, type PersonaStyle } from '../services/personaStyle';

interface PersonaState {
  persona: Persona | null; // fetched config (cached to localStorage as a fallback)
  messages: Message[]; // the ongoing persona conversation
  memory: string; // running long-term memory about the user (persisted)
  style: PersonaStyle; // active style directives (e.g. emoji on/off), persisted
  load: () => Promise<void>; // fetch the latest persona config from GitHub
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string) => void;
  setLastMessageError: (error: string) => void;
  removeLastIfEmptyAssistant: () => void;
  setMemory: (memory: string) => void;
  setStyle: (patch: Partial<PersonaStyle>) => void;
  clear: () => void; // start the persona chat over (also forgets memory + style)
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      persona: null,
      messages: [],
      memory: '',
      style: DEFAULT_STYLE,

      load: async () => {
        const persona = await fetchPersona();
        if (persona) set({ persona });
      },

      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

      updateLastMessage: (content) =>
        set((state) => {
          if (state.messages.length === 0) return state;
          const messages = [...state.messages];
          messages[messages.length - 1] = { ...messages[messages.length - 1], content };
          return { messages };
        }),

      setLastMessageError: (error) =>
        set((state) => {
          if (state.messages.length === 0) return state;
          const messages = [...state.messages];
          messages[messages.length - 1] = { ...messages[messages.length - 1], error };
          return { messages };
        }),

      removeLastIfEmptyAssistant: () =>
        set((state) => {
          const last = state.messages[state.messages.length - 1];
          if (last && last.role === 'assistant' && !last.content) {
            return { messages: state.messages.slice(0, -1) };
          }
          return state;
        }),

      setMemory: (memory) => set({ memory }),

      setStyle: (patch) => set((state) => ({ style: { ...state.style, ...patch } })),

      clear: () => set({ messages: [], memory: '', style: DEFAULT_STYLE }),
    }),
    {
      name: 'ollama-persona-store',
      // Persist the conversation, memory, style, and last-known persona (so the
      // name/avatar still show if GitHub is unreachable on next load).
      partialize: (state) => ({
        persona: state.persona,
        messages: state.messages,
        memory: state.memory,
        style: state.style,
      }),
    }
  )
);
