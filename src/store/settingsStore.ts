import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Empty string means "use the built-in default system prompt".
  systemPromptOverride: string;
  setSystemPromptOverride: (value: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      systemPromptOverride: '',
      setSystemPromptOverride: (value) => set({ systemPromptOverride: value }),
    }),
    { name: 'ollama-settings-store' }
  )
);
