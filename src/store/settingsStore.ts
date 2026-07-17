import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Empty string means "use the built-in default system prompt".
  systemPromptOverride: string;
  // Tavily API key for the web_search tool. Stored in localStorage — fine for
  // a personal free-tier key (same trust model as the tunnel URL).
  searchApiKey: string;
  setSystemPromptOverride: (value: string) => void;
  setSearchApiKey: (value: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      systemPromptOverride: '',
      searchApiKey: '',
      setSystemPromptOverride: (value) => set({ systemPromptOverride: value }),
      setSearchApiKey: (value) => set({ searchApiKey: value }),
    }),
    { name: 'ollama-settings-store' }
  )
);
