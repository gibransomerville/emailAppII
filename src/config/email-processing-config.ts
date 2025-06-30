/**
 * Email Processing Configuration
 * Controls which email processing mode to use (Gmail-style vs Standard)
 */

export interface EmailProcessingConfig {
  // Processing mode selection
  processingMode: 'gmail-style' | 'standard' | 'auto';
  
  // Gmail-style specific options
  gmailStyle: {
    preserveGmailStructure: boolean;
    handleGmailQuirks: boolean;
    applyGmailStyling: boolean;
    processGmailTables: boolean;
    sanitizeGmailContent: boolean;
    enableGmailResponsive: boolean;
  };
  
  // Standard processing options
  standard: {
    optimizeForDisplay: boolean;
    enhanceReadability: boolean;
    mobileOptimization: boolean;
    sanitizationLevel: 'minimal' | 'standard' | 'strict';
    maxWidth: string;
    allowExternalImages: boolean;
    allowNonHttpsImages: boolean;
    blockTrackingPixels: boolean;
    showImageWarnings: boolean;
  };
  
  // Auto-detection settings
  autoDetection: {
    detectGmailEmails: boolean;
    detectOutlookEmails: boolean;
    detectAppleMailEmails: boolean;
    gmailKeywords: string[];
    outlookKeywords: string[];
    appleMailKeywords: string[];
  };
  
  // Debug and logging
  debug: {
    logProcessingSteps: boolean;
    logWarnings: boolean;
    logFeatureDetection: boolean;
    showProcessingMode: boolean;
  };
}

/**
 * Default Gmail-style processing configuration
 */
export const DEFAULT_GMAIL_STYLE_CONFIG: EmailProcessingConfig = {
  processingMode: 'gmail-style',
  
  gmailStyle: {
    preserveGmailStructure: true,
    handleGmailQuirks: true,
    applyGmailStyling: true,
    processGmailTables: true,
    sanitizeGmailContent: true,
    enableGmailResponsive: true
  },
  
  standard: {
    optimizeForDisplay: true,
    enhanceReadability: true,
    mobileOptimization: true,
    sanitizationLevel: 'standard',
    maxWidth: '100%',
    allowExternalImages: true,
    allowNonHttpsImages: false,
    blockTrackingPixels: true,
    showImageWarnings: true
  },
  
  autoDetection: {
    detectGmailEmails: true,
    detectOutlookEmails: true,
    detectAppleMailEmails: true,
    gmailKeywords: ['gmail', 'google', 'gmail_', 'gmail-'],
    outlookKeywords: ['outlook', 'microsoft', 'office365', 'hotmail'],
    appleMailKeywords: ['apple', 'mail', 'mac', 'ios']
  },
  
  debug: {
    logProcessingSteps: true,
    logWarnings: true,
    logFeatureDetection: true,
    showProcessingMode: true
  }
};

/**
 * Default standard processing configuration
 */
export const DEFAULT_STANDARD_CONFIG: EmailProcessingConfig = {
  processingMode: 'standard',
  
  gmailStyle: {
    preserveGmailStructure: false,
    handleGmailQuirks: false,
    applyGmailStyling: false,
    processGmailTables: false,
    sanitizeGmailContent: true,
    enableGmailResponsive: true
  },
  
  standard: {
    optimizeForDisplay: true,
    enhanceReadability: true,
    mobileOptimization: true,
    sanitizationLevel: 'standard',
    maxWidth: '100%',
    allowExternalImages: true,
    allowNonHttpsImages: false,
    blockTrackingPixels: true,
    showImageWarnings: true
  },
  
  autoDetection: {
    detectGmailEmails: false,
    detectOutlookEmails: false,
    detectAppleMailEmails: false,
    gmailKeywords: [],
    outlookKeywords: [],
    appleMailKeywords: []
  },
  
  debug: {
    logProcessingSteps: false,
    logWarnings: true,
    logFeatureDetection: false,
    showProcessingMode: false
  }
};

/**
 * Email Processing Configuration Manager
 */
export class EmailProcessingConfigManager {
  private config: EmailProcessingConfig;
  private storageKey = 'email-processing-config';

  constructor(initialConfig?: Partial<EmailProcessingConfig>) {
    // Load from localStorage or use default
    const savedConfig = this.loadFromStorage();
    this.config = {
      ...DEFAULT_GMAIL_STYLE_CONFIG,
      ...savedConfig,
      ...initialConfig
    };
    
    this.saveToStorage();
    console.log('EmailProcessingConfigManager: Initialized with config:', this.config.processingMode);
  }

  /**
   * Get current configuration
   */
  getConfig(): EmailProcessingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EmailProcessingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveToStorage();
    console.log('EmailProcessingConfigManager: Config updated:', this.config.processingMode);
  }

  /**
   * Set processing mode
   */
  setProcessingMode(mode: 'gmail-style' | 'standard' | 'auto'): void {
    this.config.processingMode = mode;
    this.saveToStorage();
    console.log('EmailProcessingConfigManager: Processing mode set to:', mode);
  }

  /**
   * Get processing mode
   */
  getProcessingMode(): 'gmail-style' | 'standard' | 'auto' {
    return this.config.processingMode;
  }

  /**
   * Auto-detect processing mode based on email content
   */
  detectProcessingMode(email: any): 'gmail-style' | 'standard' {
    if (this.config.processingMode !== 'auto') {
      return this.config.processingMode;
    }

    const emailContent = this.extractEmailContent(email);
    const emailHeaders = this.extractEmailHeaders(email);

    // Check for Gmail indicators
    if (this.isGmailEmail(emailContent, emailHeaders)) {
      return 'gmail-style';
    }

    // Check for Outlook indicators
    if (this.isOutlookEmail(emailContent, emailHeaders)) {
      return 'standard';
    }

    // Check for Apple Mail indicators
    if (this.isAppleMailEmail(emailContent, emailHeaders)) {
      return 'standard';
    }

    // Default to standard processing
    return 'standard';
  }

  /**
   * Check if email appears to be from Gmail
   */
  private isGmailEmail(content: string, headers: Record<string, string>): boolean {
    if (!this.config.autoDetection.detectGmailEmails) {
      return false;
    }

    const searchText = (content + ' ' + Object.values(headers).join(' ')).toLowerCase();

    return this.config.autoDetection.gmailKeywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if email appears to be from Outlook
   */
  private isOutlookEmail(content: string, headers: Record<string, string>): boolean {
    if (!this.config.autoDetection.detectOutlookEmails) {
      return false;
    }

    const searchText = (content + ' ' + Object.values(headers).join(' ')).toLowerCase();

    return this.config.autoDetection.outlookKeywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if email appears to be from Apple Mail
   */
  private isAppleMailEmail(content: string, headers: Record<string, string>): boolean {
    if (!this.config.autoDetection.detectAppleMailEmails) {
      return false;
    }

    const searchText = (content + ' ' + Object.values(headers).join(' ')).toLowerCase();

    return this.config.autoDetection.appleMailKeywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Extract email content for detection
   */
  private extractEmailContent(email: any): string {
    return [
      email.bodyHtml || '',
      email.bodyText || '',
      email.body || '',
      (email as any).snippet || '',
      email.subject || ''
    ].join(' ');
  }

  /**
   * Extract email headers for detection
   */
  private extractEmailHeaders(email: any): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (email.headers) {
      if (typeof email.headers === 'object') {
        Object.assign(headers, email.headers);
      } else if (email.headers instanceof Map) {
        email.headers.forEach((value: string, key: string) => {
          headers[key] = value;
        });
      }
    }

    // Add common header fields
    if (email.from) headers['from'] = JSON.stringify(email.from);
    if (email.to) headers['to'] = JSON.stringify(email.to);
    if (email.subject) headers['subject'] = email.subject;
    if (email.date) headers['date'] = email.date;

    return headers;
  }

  /**
   * Load configuration from localStorage
   */
  private loadFromStorage(): Partial<EmailProcessingConfig> | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to load email processing config from storage:', error);
      return null;
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save email processing config to storage:', error);
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_GMAIL_STYLE_CONFIG };
    this.saveToStorage();
    console.log('EmailProcessingConfigManager: Reset to defaults');
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      processingMode: this.config.processingMode,
      autoDetectionEnabled: this.config.processingMode === 'auto',
      debugEnabled: this.config.debug.logProcessingSteps,
      configTimestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const emailProcessingConfig = new EmailProcessingConfigManager(); 