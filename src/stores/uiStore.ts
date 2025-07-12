// src/stores/uiStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  theme: 'light' | 'dark';
  modals: { 
    compose: boolean; 
    settings: boolean; 
    oauthLoading: boolean;
  };
  notifications: Array<{ 
    id: string;
    message: string; 
    type: 'success' | 'error' | 'warning' | 'info';
    timestamp: number;
  }>;
  loading: boolean;
  toggleTheme: () => void;
  showModal: (type: 'compose' | 'settings' | 'oauthLoading') => void;
  hideModal: (type: 'compose' | 'settings' | 'oauthLoading') => void;
  addNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      modals: { compose: false, settings: false, oauthLoading: false },
      notifications: [],
      loading: false,
      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'light' ? 'dark' : 'light' 
      })),
      showModal: (type) => set((state) => ({ 
        modals: { ...state.modals, [type]: true } 
      })),
      hideModal: (type) => set((state) => ({ 
        modals: { ...state.modals, [type]: false } 
      })),
      addNotification: (message, type) => set((state) => ({ 
        notifications: [
          ...state.notifications, 
          { 
            id: Date.now().toString(), 
            message, 
            type, 
            timestamp: Date.now() 
          }
        ] 
      })),
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),
      clearNotifications: () => set({ notifications: [] }),
      setLoading: (loading) => set({ loading }),
    }),
    { 
      name: 'ui-storage', 
      partialize: (state) => ({ theme: state.theme }) // Persist theme only
    }
  )
); 