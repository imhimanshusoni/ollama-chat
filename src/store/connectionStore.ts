import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionStatus } from '../types';

interface ConnectionState {
  baseUrl: string;
  currentModel: string;
  models: string[];
  status: ConnectionStatus;
  errorMessage: string;
  isManualOverride: boolean;
  setBaseUrl: (url: string, opts?: { manual?: boolean }) => void;
  setCurrentModel: (model: string) => void;
  setModels: (models: string[]) => void;
  setStatus: (status: ConnectionStatus, errorMessage?: string) => void;
  clearManualOverride: () => void;
}

function migrateOldData(): { baseUrl: string; currentModel: string } | null {
  try {
    const rawUrl = localStorage.getItem('ollama_url');
    const rawModel = localStorage.getItem('ollama_model');
    if (rawUrl || rawModel) {
      const result = {
        baseUrl: rawUrl || 'http://localhost:11434',
        currentModel: rawModel || '',
      };
      localStorage.removeItem('ollama_url');
      localStorage.removeItem('ollama_model');
      return result;
    }
  } catch {
    // ignore migration errors
  }
  return null;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set) => {
      const migrated = migrateOldData();

      return {
        baseUrl: migrated?.baseUrl ?? 'http://localhost:11434',
        currentModel: migrated?.currentModel ?? '',
        models: [],
        status: 'idle' as ConnectionStatus,
        errorMessage: '',
        isManualOverride: false,

        setBaseUrl: (url, opts) => set({ baseUrl: url, isManualOverride: opts?.manual ?? false }),
        setCurrentModel: (model) => set({ currentModel: model }),
        setModels: (models) => set({ models }),
        setStatus: (status, errorMessage = '') => set({ status, errorMessage }),
        clearManualOverride: () => set({ isManualOverride: false }),
      };
    },
    {
      name: 'ollama-connection-store',
      partialize: (state) => ({
        baseUrl: state.baseUrl,
        currentModel: state.currentModel,
        isManualOverride: state.isManualOverride,
      }),
    }
  )
);
