/**
 * Settings Manager Module
 * Handles email configuration, settings management, and modal operations
 * Dependencies: ipcRenderer (electron), global variables (emailConfig, settingsModal, etc.)
 */

import type { EmailConfig } from '../../types/config';

/**
 * Settings form data interface
 */
export interface SettingsFormData {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * IPC result interface
 */
export interface IPCResult {
  success: boolean;
  config?: EmailConfig;
  error?: string;
}

/**
 * SettingsManager - Centralized settings and configuration management
 */
const SettingsManager = {
  /**
   * Validate that required dependencies are available
   * @returns True if all dependencies are available
   */
  validateDependencies(): boolean {
    const missing: string[] = [];
    
    if (typeof (window as any).ipcRenderer === 'undefined') {
      missing.push('ipcRenderer (electron)');
    }
    
    if (missing.length > 0) {
      console.error('SettingsManager module missing dependencies:', missing);
      return false;
    }
    
    return true;
  },

  /**
   * Load email configuration from storage
   */
  async loadEmailConfig(): Promise<void> {
    try {
      const ipcRenderer = (window as any).ipcRenderer;
      const result: IPCResult = await ipcRenderer.invoke('load-email-config');
      if (result.success && result.config) {
        if (typeof (window as any).emailConfig !== 'undefined') {
          (window as any).emailConfig = result.config;
        } else {
          (window as any).emailConfig = result.config;
        }
        this.populateSettingsForm();
      }
    } catch (error) {
      console.error('Error loading email config:', error);
    }
  },

  /**
   * Save email configuration to storage
   */
  async saveEmailConfig(): Promise<void> {
    const emailInput = document.getElementById('email-input') as HTMLInputElement;
    const passwordInput = document.getElementById('password-input') as HTMLInputElement;
    const smtpHostInput = document.getElementById('smtp-host') as HTMLInputElement;
    const smtpPortInput = document.getElementById('smtp-port') as HTMLInputElement;
    const imapHostInput = document.getElementById('imap-host') as HTMLInputElement;
    const imapPortInput = document.getElementById('imap-port') as HTMLInputElement;

    const config: SettingsFormData = {
      email: emailInput?.value || '',
      password: passwordInput?.value || '',
      smtpHost: smtpHostInput?.value || '',
      smtpPort: parseInt(smtpPortInput?.value || '587'),
      imapHost: imapHostInput?.value || '',
      imapPort: parseInt(imapPortInput?.value || '993')
    };

    try {
      const ipcRenderer = (window as any).ipcRenderer;
      const result: IPCResult = await ipcRenderer.invoke('save-email-config', config);
      if (result.success) {
        if (typeof (window as any).emailConfig !== 'undefined') {
          (window as any).emailConfig = config;
        } else {
          (window as any).emailConfig = config;
        }
        this.hideSettingsModal();
        
        const showNotification = (window as any).showNotification;
        if (typeof showNotification !== 'undefined') {
          showNotification('Settings saved successfully!', 'success');
        }
        
        const loadEmails = (window as any).loadEmails;
        if (typeof loadEmails !== 'undefined') {
          loadEmails();
        }
      } else {
        const showNotification = (window as any).showNotification;
        if (typeof showNotification !== 'undefined') {
          showNotification('Failed to save settings', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving email config:', error);
      const showNotification = (window as any).showNotification;
      if (typeof showNotification !== 'undefined') {
        showNotification('Error saving settings', 'error');
      }
    }
  },

  /**
   * Populate settings form with current configuration
   */
  populateSettingsForm(): void {
    const config = (typeof (window as any).emailConfig !== 'undefined' ? 
      (window as any).emailConfig : 
      (window as any).emailConfig) || {};
    
    const emailInput = document.getElementById('email-input') as HTMLInputElement;
    const passwordInput = document.getElementById('password-input') as HTMLInputElement;
    const smtpHostInput = document.getElementById('smtp-host') as HTMLInputElement;
    const smtpPortInput = document.getElementById('smtp-port') as HTMLInputElement;
    const imapHostInput = document.getElementById('imap-host') as HTMLInputElement;
    const imapPortInput = document.getElementById('imap-port') as HTMLInputElement;
    
    if (emailInput) emailInput.value = config.email || '';
    if (passwordInput) passwordInput.value = config.password || '';
    if (smtpHostInput) smtpHostInput.value = config.smtpHost || 'smtp.gmail.com';
    if (smtpPortInput) smtpPortInput.value = config.smtpPort?.toString() || '587';
    if (imapHostInput) imapHostInput.value = config.imapHost || 'imap.gmail.com';
    if (imapPortInput) imapPortInput.value = config.imapPort?.toString() || '993';
  },

  // REMOVED: showSettingsModal - EventManager has sole responsibility for modal control

  /**
   * Hide settings modal
   */
  hideSettingsModal(): void {
    console.log('SettingsManager.hideSettingsModal called');
    
    const modal = (typeof (window as any).settingsModal !== 'undefined' ? 
      (window as any).settingsModal : 
      document.getElementById('settings-modal')) as HTMLElement;
    
    if (modal) {
      modal.classList.remove('show');
      console.log('Settings modal hidden');
    } else {
      console.error('Settings modal element not found');
    }
  },

  /**
   * Initialize settings manager
   */
  initialize(): void {
    console.log('SettingsManager initialized');
    
    // Auto-load email config on initialization
    this.loadEmailConfig().catch(error => {
      console.warn('Failed to auto-load email config:', error);
    });
    
    // Set up event listeners for settings form if available
    this.setupEventListeners();
  },

  /**
   * Set up event listeners for settings form
   */
  setupEventListeners(): void {
    // Save button
    const saveButton = document.getElementById('save-settings-btn') as HTMLButtonElement;
    if (saveButton) {
      saveButton.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.saveEmailConfig();
      });
    }
    
    // Cancel button
    const cancelButton = document.getElementById('cancel-settings-btn') as HTMLButtonElement;
    if (cancelButton) {
      cancelButton.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.hideSettingsModal();
      });
    }
    
    // Settings form submission
    const settingsForm = document.getElementById('settings-form') as HTMLFormElement;
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        this.saveEmailConfig();
      });
    }
  },

  /**
   * Get current email configuration
   * @returns Current email configuration or null
   */
  getCurrentConfig(): EmailConfig | null {
    return (typeof (window as any).emailConfig !== 'undefined' ? 
      (window as any).emailConfig : 
      (window as any).emailConfig) || null;
  },

  /**
   * Update email configuration
   * @param newConfig - New configuration object
   */
  updateConfig(newConfig: Partial<EmailConfig>): void {
    if (typeof (window as any).emailConfig !== 'undefined') {
      (window as any).emailConfig = { ...(window as any).emailConfig, ...newConfig };
    } else {
      (window as any).emailConfig = { ...((window as any).emailConfig || {}), ...newConfig };
    }
  },

  /**
   * Reset settings form to defaults
   */
  resetToDefaults(): void {
    const defaultConfig: EmailConfig = {
      email: '',
      password: '',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      smtpSecure: true,
      imapSecure: true
    };
    
    this.updateConfig(defaultConfig);
    this.populateSettingsForm();
  },

  /**
   * Validate current configuration
   * @returns Validation result with isValid boolean and errors array
   */
  validateConfig(): ValidationResult {
    const config = this.getCurrentConfig();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!config) {
      errors.push('No configuration found');
      return { isValid: false, errors, warnings };
    }
    
    if (!config.email || !config.email.trim()) {
      errors.push('Email address is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
      errors.push('Invalid email address format');
    }
    
    if (!config.password || !config.password.trim()) {
      errors.push('Password is required');
    }
    
    if (!config.smtpHost || !config.smtpHost.trim()) {
      errors.push('SMTP host is required');
    }
    
    if (!config.smtpPort || config.smtpPort < 1 || config.smtpPort > 65535) {
      errors.push('Valid SMTP port is required (1-65535)');
    }
    
    if (!config.imapHost || !config.imapHost.trim()) {
      errors.push('IMAP host is required');
    }
    
    if (!config.imapPort || config.imapPort < 1 || config.imapPort > 65535) {
      errors.push('Valid IMAP port is required (1-65535)');
    }
    
    // Add warnings for common issues
    if (config.smtpPort === 25 && !config.smtpSecure) {
      warnings.push('Port 25 typically requires SSL/TLS for security');
    }
    
    if (config.imapPort === 143 && !config.imapSecure) {
      warnings.push('Port 143 typically requires SSL/TLS for security');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
};

// Legacy function wrappers for backward compatibility
async function loadEmailConfig(): Promise<void> {
  return await SettingsManager.loadEmailConfig();
}

async function saveEmailConfig(): Promise<void> {
  return await SettingsManager.saveEmailConfig();
}

function populateSettingsForm(): void {
  return SettingsManager.populateSettingsForm();
}

// REMOVED: Global showSettingsModal - EventManager has sole responsibility

function hideSettingsModal(): void {
  return SettingsManager.hideSettingsModal();
}

// Browser-compatible module loading
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).SettingsManager = SettingsManager;
  
  // Make legacy functions globally available
  (window as any).loadEmailConfig = loadEmailConfig;
  (window as any).saveEmailConfig = saveEmailConfig;
  (window as any).populateSettingsForm = populateSettingsForm;
      // REMOVED: Global assignment - EventManager has sole responsibility
  (window as any).hideSettingsModal = hideSettingsModal;
  
  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (SettingsManager.validateDependencies()) {
        SettingsManager.initialize();
        console.log('SettingsManager module loaded and initialized');
      }
    });
  } else {
    if (SettingsManager.validateDependencies()) {
      SettingsManager.initialize();
      console.log('SettingsManager module loaded and initialized');
    }
  }
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    SettingsManager,
    loadEmailConfig,
    saveEmailConfig,
    populateSettingsForm,
    hideSettingsModal
  };
} 