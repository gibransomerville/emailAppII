// src/stores/settingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { platformStorage } from './middleware/storage.js';

export interface EmailSettings {
  autoRefresh: boolean;
  refreshInterval: number; // in minutes
  maxEmailsPerPage: number;
  showPreview: boolean;
  markAsReadOnOpen: boolean;
  downloadAttachments: boolean;
  maxAttachmentSize: number; // in MB
}

export interface UISettings {
  sidebarCollapsed: boolean;
  showUnreadCount: boolean;
  compactMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  showTimestamps: boolean;
}

export interface SecuritySettings {
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
  validateSettings: () => { isValid: boolean; errors: string[] };
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

// Settings validation
const validateEmailSettings = (settings: EmailSettings): string[] => {
  const errors: string[] = [];
  
  if (settings.refreshInterval < 1 || settings.refreshInterval > 60) {
    errors.push('Refresh interval must be between 1 and 60 minutes');
  }
  
  if (settings.maxEmailsPerPage < 10 || settings.maxEmailsPerPage > 200) {
    errors.push('Max emails per page must be between 10 and 200');
  }
  
  if (settings.maxAttachmentSize < 1 || settings.maxAttachmentSize > 100) {
    errors.push('Max attachment size must be between 1 and 100 MB');
  }
  
  return errors;
};

const validateSecuritySettings = (settings: SecuritySettings): string[] => {
  const errors: string[] = [];
  
  if (settings.sessionTimeout < 5 || settings.sessionTimeout > 480) {
    errors.push('Session timeout must be between 5 and 480 minutes');
  }
  
  return errors;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      email: defaultEmailSettings,
      ui: defaultUISettings,
      security: defaultSecuritySettings,
      
      updateEmailSettings: (settings) => {
        const currentSettings = get().email;
        const newSettings = { ...currentSettings, ...settings };
        const errors = validateEmailSettings(newSettings);
        
        if (errors.length > 0) {
          console.warn('Email settings validation errors:', errors);
          return;
        }
        
        set((state) => ({
          email: { ...state.email, ...settings }
        }));
      },
      
      updateUISettings: (settings) => set((state) => ({
        ui: { ...state.ui, ...settings }
      })),
      
      updateSecuritySettings: (settings) => {
        const currentSettings = get().security;
        const newSettings = { ...currentSettings, ...settings };
        const errors = validateSecuritySettings(newSettings);
        
        if (errors.length > 0) {
          console.warn('Security settings validation errors:', errors);
          return;
        }
        
        set((state) => ({
          security: { ...state.security, ...settings }
        }));
      },
      
      resetToDefaults: () => set({
        email: defaultEmailSettings,
        ui: defaultUISettings,
        security: defaultSecuritySettings,
      }),
      
      validateSettings: () => {
        const state = get();
        const emailErrors = validateEmailSettings(state.email);
        const securityErrors = validateSecuritySettings(state.security);
        const allErrors = [...emailErrors, ...securityErrors];
        
        return {
          isValid: allErrors.length === 0,
          errors: allErrors
        };
      },
    }),
    {
      name: 'settings-storage',
      storage: platformStorage,
      partialize: (state) => ({
        email: state.email,
        ui: state.ui,
        security: state.security,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const validation = state.validateSettings();
          if (!validation.isValid) {
            console.warn('Invalid settings detected, resetting to defaults:', validation.errors);
            state.resetToDefaults();
          }
        }
      },
    }
  )
); 