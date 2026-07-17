import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types';

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function migrateOldTheme(): Theme | null {
  try {
    const raw = localStorage.getItem('ollama_theme');
    if (raw === 'dark' || raw === 'light') {
      localStorage.removeItem('ollama_theme');
      return raw;
    }
  } catch {
    // ignore migration errors
  }
  return null;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => {
      const migrated = migrateOldTheme();
      const initialTheme: Theme = migrated ?? 'dark';

      // Apply theme immediately on store creation
      applyTheme(initialTheme);

      return {
        theme: initialTheme,
        sidebarOpen: typeof window !== 'undefined' ? window.innerWidth > 768 : true,
        settingsOpen: false,

        toggleTheme: () =>
          set((state) => {
            const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            return { theme: next };
          }),

        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        setSettingsOpen: (open) => set({ settingsOpen: open }),
      };
    },
    {
      name: 'ollama-ui-store',
      partialize: (state) => ({
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply the persisted theme when store rehydrates
        if (state?.theme) {
          applyTheme(state.theme);
        }
      },
    }
  )
);
