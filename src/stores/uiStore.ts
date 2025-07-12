// src/stores/uiStore.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { platformStorage } from './middleware/storage.js';

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
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  showModal: (type: 'compose' | 'settings' | 'oauthLoading') => void;
  hideModal: (type: 'compose' | 'settings' | 'oauthLoading') => void;
  addNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const MAX_NOTIFICATIONS = 10; // Limit notifications for performance

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

export const useUIStore = create<UIState>()(
  devtools(
    immer(
      persist(
        (set, get) => ({
          theme: 'light',
          modals: { compose: false, settings: false, oauthLoading: false },
          notifications: [],
          loading: false,
          sidebarCollapsed: false,
          
          toggleTheme: () => set((state) => {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
          }),
          
          showModal: (type) => set((state) => {
            state.modals[type] = true;
          }),
          
          hideModal: (type) => set((state) => {
            state.modals[type] = false;
          }),
          
          addNotification: (message, type) => set((state) => {
            const newNotification = { 
              id: Date.now().toString(), 
              message, 
              type, 
              timestamp: Date.now() 
            };
            
            // Limit notifications to prevent memory issues
            state.notifications.unshift(newNotification);
            if (state.notifications.length > MAX_NOTIFICATIONS) {
              state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
            }
          }),
          
          removeNotification: (id) => set((state) => {
            state.notifications = state.notifications.filter(n => n.id !== id);
          }),
          
          clearNotifications: () => set((state) => {
            state.notifications = [];
          }),
          
          setLoading: (loading) => set((state) => {
            state.loading = loading;
          }),
          
          toggleSidebar: () => set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          }),
          
          setSidebarCollapsed: (collapsed) => set((state) => {
            state.sidebarCollapsed = collapsed;
          }),
        }),
        { 
          name: 'ui-storage', 
          storage: platformStorage,
          partialize: (state) => ({ 
            theme: state.theme,
            sidebarCollapsed: state.sidebarCollapsed 
          }) // Persist theme and sidebar state only
        }
      )
    ),
    { 
      name: 'UIStore', 
      enabled: isDevelopment 
    }
  )
); 