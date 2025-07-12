// src/stores/settingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EmailSettings {
  autoRefresh: boolean;
  refreshInterval: number; // in minutes
  maxEmailsPerPage: number;
  showPreview: boolean;
  markAsReadOnOpen: boolean;
  downloadAttachments: boolean;
  maxAttachmentSize: number; // in MB
}

interface UISettings {
  sidebarCollapsed: boolean;
  showUnreadCount: boolean;
  compactMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  showTimestamps: boolean;
}

interface SecuritySettings {
  autoLogout: boolean;
  sessionTimeout: number; // in minutes
  requirePasswordForSettings: boolean;
}

interface SettingsState {
  email: EmailSettings;
  ui: UISettings;
  security: SecuritySettings;
  updateEmailSettings: (settings: Partial<EmailSettings>) => void;
  updateUISettings: (settings: Partial<UISettings>) => void;
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => void;
  resetToDefaults: () => void;
}

const defaultEmailSettings: EmailSettings = {
  autoRefresh: true,
  refreshInterval: 5,
  maxEmailsPerPage: 50,
  showPreview: true,
  markAsReadOnOpen: true,
  downloadAttachments: false,
  maxAttachmentSize: 10,
};

const defaultUISettings: UISettings = {
  sidebarCollapsed: false,
  showUnreadCount: true,
  compactMode: false,
  fontSize: 'medium',
  showTimestamps: true,
};

const defaultSecuritySettings: SecuritySettings = {
  autoLogout: false,
  sessionTimeout: 30,
  requirePasswordForSettings: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      email: defaultEmailSettings,
      ui: defaultUISettings,
      security: defaultSecuritySettings,
      updateEmailSettings: (settings) => set((state) => ({
        email: { ...state.email, ...settings }
      })),
      updateUISettings: (settings) => set((state) => ({
        ui: { ...state.ui, ...settings }
      })),
      updateSecuritySettings: (settings) => set((state) => ({
        security: { ...state.security, ...settings }
      })),
      resetToDefaults: () => set({
        email: defaultEmailSettings,
        ui: defaultUISettings,
        security: defaultSecuritySettings,
      }),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        email: state.email,
        ui: state.ui,
        security: state.security,
      }),
    }
  )
); 