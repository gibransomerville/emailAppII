/**
 * Email Processing UI Component
 * Provides user interface for switching between email processing modes
 */

import { emailProcessingConfig, type EmailProcessingConfig } from './email-processing-config.js';

export class EmailProcessingUI {
  private container: HTMLElement | null = null;
  private modeSelector: HTMLSelectElement | null = null;
  private statusIndicator: HTMLElement | null = null;

  /**
   * Initialize the email processing UI
   * @param containerId - ID of the container element
   */
  initialize(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`EmailProcessingUI: Container with ID '${containerId}' not found`);
      return;
    }

    this.container = container;
    this.createUI();
    this.updateUI();
    this.attachEventListeners();
    
    console.log('EmailProcessingUI: Initialized');
  }

  /**
   * Create the UI elements
   */
  private createUI(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="email-processing-controls" style="
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 12px;
        margin: 8px 0;
        font-family: Arial, sans-serif;
        font-size: 13px;
      ">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <label for="email-processing-mode" style="
            font-weight: 600;
            color: #495057;
            margin: 0;
          ">
            Email Processing Mode:
          </label>
          
          <select id="email-processing-mode" style="
            padding: 6px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 13px;
            background: white;
            cursor: pointer;
          ">
            <option value="gmail-style">Gmail-Style Processing</option>
            <option value="standard">Standard Processing</option>
            <option value="auto">Auto-Detect</option>
          </select>
          
          <div id="email-processing-status" style="
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          ">
            Status
          </div>
          
          <button id="email-processing-info" style="
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 12px;
          ">
            ℹ️ Info
          </button>
        </div>
        
        <div id="email-processing-description" style="
          margin-top: 8px;
          font-size: 12px;
          color: #6c757d;
          line-height: 1.4;
        ">
          Description will appear here
        </div>
      </div>
    `;

    this.modeSelector = document.getElementById('email-processing-mode') as HTMLSelectElement;
    this.statusIndicator = document.getElementById('email-processing-status');
  }

  /**
   * Update the UI based on current configuration
   */
  private updateUI(): void {
    if (!this.modeSelector || !this.statusIndicator) return;

    const config = emailProcessingConfig.getConfig();
    const currentMode = config.processingMode;

    // Update selector
    this.modeSelector.value = currentMode;

    // Update status indicator
    this.updateStatusIndicator(currentMode);

    // Update description
    this.updateDescription(currentMode);
  }

  /**
   * Update status indicator styling
   */
  private updateStatusIndicator(mode: string): void {
    if (!this.statusIndicator) return;

    const statusConfig = {
      'gmail-style': {
        text: 'Gmail-Style',
        color: '#28a745',
        background: '#d4edda',
        border: '#c3e6cb'
      },
      'standard': {
        text: 'Standard',
        color: '#007bff',
        background: '#d1ecf1',
        border: '#bee5eb'
      },
      'auto': {
        text: 'Auto-Detect',
        color: '#ffc107',
        background: '#fff3cd',
        border: '#ffeaa7'
      }
    };

    const status = statusConfig[mode as keyof typeof statusConfig] || statusConfig.standard;

    this.statusIndicator.textContent = status.text;
    this.statusIndicator.style.color = status.color;
    this.statusIndicator.style.background = status.background;
    this.statusIndicator.style.border = `1px solid ${status.border}`;
  }

  /**
   * Update description text
   */
  private updateDescription(mode: string): void {
    const descriptionElement = document.getElementById('email-processing-description');
    if (!descriptionElement) return;

    const descriptions = {
      'gmail-style': 'Uses Gmail-specific processing patterns, preserves Gmail structure, and applies Gmail styling quirks for authentic Gmail experience.',
      'standard': 'Uses standard email processing with enhanced readability, mobile optimization, and comprehensive sanitization.',
      'auto': 'Automatically detects email source and applies appropriate processing mode (Gmail-style for Gmail emails, Standard for others).'
    };

    descriptionElement.textContent = descriptions[mode as keyof typeof descriptions] || descriptions.standard;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modeSelector) return;

    // Mode selector change
    this.modeSelector.addEventListener('change', (event) => {
      const target = event.target as HTMLSelectElement;
      const newMode = target.value as 'gmail-style' | 'standard' | 'auto';
      
      emailProcessingConfig.setProcessingMode(newMode);
      this.updateUI();
      
      // Trigger email refresh if needed
      this.triggerEmailRefresh();
    });

    // Info button click
    const infoButton = document.getElementById('email-processing-info');
    if (infoButton) {
      infoButton.addEventListener('click', () => {
        this.showInfoDialog();
      });
    }
  }

  /**
   * Trigger email refresh to apply new processing mode
   */
  private triggerEmailRefresh(): void {
    // Dispatch custom event to notify other components
    const event = new CustomEvent('emailProcessingModeChanged', {
      detail: {
        mode: emailProcessingConfig.getProcessingMode(),
        timestamp: new Date().toISOString()
      }
    });
    
    document.dispatchEvent(event);
    console.log('EmailProcessingUI: Dispatched emailProcessingModeChanged event');
  }

  /**
   * Show information dialog
   */
  private showInfoDialog(): void {
    const config = emailProcessingConfig.getConfig();
    const debugInfo = emailProcessingConfig.getDebugInfo();

    const infoText = `
Email Processing Configuration

Current Mode: ${config.processingMode}
Auto-Detection: ${config.processingMode === 'auto' ? 'Enabled' : 'Disabled'}
Debug Logging: ${config.debug.logProcessingSteps ? 'Enabled' : 'Disabled'}

Gmail-Style Features:
• Preserve Gmail Structure: ${config.gmailStyle.preserveGmailStructure}
• Handle Gmail Quirks: ${config.gmailStyle.handleGmailQuirks}
• Apply Gmail Styling: ${config.gmailStyle.applyGmailStyling}
• Process Gmail Tables: ${config.gmailStyle.processGmailTables}

Standard Features:
• Optimize for Display: ${config.standard.optimizeForDisplay}
• Enhance Readability: ${config.standard.enhanceReadability}
• Mobile Optimization: ${config.standard.mobileOptimization}
• Sanitization Level: ${config.standard.sanitizationLevel}

Debug Info:
• Config Timestamp: ${debugInfo.configTimestamp}
• Auto-Detection Enabled: ${debugInfo.autoDetectionEnabled}
• Debug Enabled: ${debugInfo.debugEnabled}
    `;

    alert(infoText);
  }

  /**
   * Show the UI
   */
  show(): void {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  /**
   * Hide the UI
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Get current processing mode
   */
  getCurrentMode(): string {
    return emailProcessingConfig.getProcessingMode();
  }

  /**
   * Set processing mode programmatically
   */
  setMode(mode: 'gmail-style' | 'standard' | 'auto'): void {
    emailProcessingConfig.setProcessingMode(mode);
    this.updateUI();
    this.triggerEmailRefresh();
  }

  /**
   * Get configuration
   */
  getConfig(): EmailProcessingConfig {
    return emailProcessingConfig.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EmailProcessingConfig>): void {
    emailProcessingConfig.updateConfig(updates);
    this.updateUI();
  }
}

// Export singleton instance
export const emailProcessingUI = new EmailProcessingUI(); 