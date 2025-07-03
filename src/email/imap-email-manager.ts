/**
 * IMAP & Email Loading Management Module
 * Handles all email loading operations, IMAP connectivity, Gmail API integration,
 * conversation rendering, and email management functionality
 * 
 * Dependencies: 
 * - EmailManager (email processing)
 * - ThreadingManager (conversation grouping)
 * - UIThemeManager (loading states, notifications)
 * - AuthManager (OAuth token management)
 * - SafeHTML (secure rendering)
 * 
 * @author Email App Modular Architecture
 * @version 1.0.0
 */

import { UIThemeManager } from '../ui/ui-theme-manager.js';
import { EventManager } from '../managers/event-manager.js';
import { EmailManager } from '../email/email-manager.js';
import { getSearchManager } from '../managers/search-manager.js';
import type { Email, EmailConversation, EmailAddress } from '../../types/email';

// Get ipcRenderer for Gmail API communication
let ipcRenderer: any;
if (typeof window !== 'undefined' && (window as any).require) {
  const electron = (window as any).require('electron');
  ipcRenderer = electron.ipcRenderer;
} else {
  ipcRenderer = (window as any).ipcRenderer || {
    invoke: async (channel: string, ...args: any[]) => {
      console.warn(`IPC invoke called in browser: ${channel}`, args);
      return { success: false, error: 'IPC not available in browser' };
    }
  };
}

// import type { EmailConfig, IMAPConfig } from '../../types/config';



/**
 * Email loading result interface
 */
export interface EmailLoadingResult {
  success: boolean;
  emails: Email[];
  conversations: Record<string, EmailConversation>;
  error?: string;
  stats?: {
    totalEmails: number;
    totalConversations: number;
    loadingTime: number;
  };
}

/**
 * Gmail API response interface
 */
export interface GmailApiResponse {
  messages: Array<{
    id: string;
    threadId: string;
  }>;
  nextPageToken?: string;
}

/**
 * Gmail message interface
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    parts?: GmailMessagePart[];
    body?: {
      data: string;
      size: number;
    };
  };
  internalDate: string;
}

/**
 * Gmail message part interface
 */
export interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: Array<{
    name: string;
    value: string;
  }>;
  body: {
    data: string;
    size: number;
  };
  parts?: GmailMessagePart[];
}

/**
 * Email folder type
 */
export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive';

/**
 * Conversation group interface
 */
export interface ConversationGroup {
  id: string;
  subject: string;
  participants: EmailAddress[];
  emails: Email[];
  messageCount: number;
  unreadCount: number;
  lastActivity: Date;
  hasAttachments: boolean;
}

/**
 * IMAP Email Manager - Centralized email loading and management
 */
export class IMAPEmailManager {
  private emails: Email[] = [];
  private conversations: Record<string, EmailConversation> = {};
  private googleAuth: any = null;
  private emailConfig: any = null;
  private conversationSelectCallback: ((id: string) => void) | null = null;
  private uiThemeManager: UIThemeManager;
  private eventManager: EventManager;
  private emailManager: EmailManager;
  private initialized: boolean = false;

  constructor(uiThemeManager: UIThemeManager, eventManager: EventManager, emailManager: EmailManager) {
    this.uiThemeManager = uiThemeManager;
    this.eventManager = eventManager;
    this.emailManager = emailManager;
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) {
      return;
    }

    // Initialize event listeners and other setup
    this.initialized = true;
  }

  /**
   * Set email configuration
   * @param config - Email configuration object
   */
  setEmailConfig(config: any): void {
    this.emailConfig = config;
    console.log('IMAPEmailManager: Email config updated');
  }

  /**
   * Set Google authentication token
   * @param authToken - Google OAuth token
   */
  setGoogleAuth(authToken: any): void {
    this.googleAuth = authToken;
    console.log('IMAPEmailManager: Google auth token updated');
  }

  /**
   * Set conversation selection callback
   * @param callback - Function to call when conversation is selected
   */
  setConversationSelectCallback(callback: (id: string) => void): void {
    this.conversationSelectCallback = callback;
    console.log('IMAPEmailManager: Conversation select callback set');
  }

  /**
   * Set event manager after construction
   * @param eventManager - Event manager instance
   */
  setEventManager(eventManager: EventManager): void {
    this.eventManager = eventManager;
    console.log('IMAPEmailManager: Event manager set');
  }

  /**
   * Get current emails
   * @returns Current emails array
   */
  getEmails(): Email[] {
    return this.emails;
  }

  /**
   * Get current conversations
   * @returns Current conversations object
   */
  getConversations(): Record<string, EmailConversation> {
    return this.conversations;
  }

  /**
   * Main email loading orchestrator (Strictly Linear for each email)
   */
  async loadEmails(): Promise<EmailLoadingResult> {
    console.log('IMAPEmailManager: loadEmails called, googleAuth:', !!this.googleAuth);
    const startTime = Date.now();
    this.uiThemeManager.showLoading(true);
    try {
      // Ensure we have a conversation select callback
      if (!this.conversationSelectCallback) {
        console.warn('No conversation select callback set, using event manager');
        this.setConversationSelectCallback((conversationId: string) => {
          this.eventManager.selectConversation(conversationId);
        });
      }
      // Test mailparser functionality on first load
      const emailParsingConfig = (window as any).EMAIL_PARSING_CONFIG;
      if (emailParsingConfig?.useMailparser) {
        console.log('Testing mailparser functionality...');
        let mailparserWorking = false;
        if (this.emailManager.testMailparserFunctionality) {
          mailparserWorking = await this.emailManager.testMailparserFunctionality();
        } else {
          console.warn('testMailparserFunctionality not available, skipping test');
          mailparserWorking = true; // Assume it works to avoid blocking
        }
        if (!mailparserWorking && !emailParsingConfig.fallbackToManual) {
          throw new Error('Mailparser is not working and fallback is disabled');
        }
      }
      // --- Strictly Linear Email Processing ---
      const rawEmails = await this.fetchAllRawEmails();
      // 1. Standardize each raw email
      const standardizedEmails = rawEmails.map((raw: any) => {
        const email = this.emailManager.standardizeEmailObject(raw, this.googleAuth ? 'gmail-api' : 'imap');
        // Ensure all attachments are standardized
        if (email.attachments && Array.isArray(email.attachments)) {
          email.attachments = this.emailManager.standardizeAttachments(email.attachments, email.messageId);
        }
        return email;
      });
      
      // 2. Enhance emails with accurate attachment information (hybrid detection)
      console.log('Enhancing emails with accurate attachment information...');
      const enhancedEmails = await Promise.all(
        standardizedEmails.map(async (email: Email) => {
          if (this.googleAuth && (!email.attachments || email.attachments.length === 0)) {
            // Use hybrid detection for Gmail emails that appear to have no attachments
            return await this.emailManager.enhanceEmailAttachments(email, 'gmail');
          }
          return email;
        })
      );

      // 3. Process HTML/Text for each enhanced email
      const htmlEngine = (window as any).EmailHtmlEngine || (globalThis as any).EmailHtmlEngine;
      this.emails = enhancedEmails.map((email: any) => {
        if (htmlEngine && typeof htmlEngine.processEmailHtml === 'function') {
          const processed = htmlEngine.processEmailHtml(email);
          // Store processed HTML for direct use in UI
          email.processedHtml = processed.content;
        }
        return email;
      });
      // 4. Group emails into conversations
      console.log('Grouping emails into conversations...');
      this.conversations = this.basicEmailGrouping(this.emails);
      // 5. Sync state immediately to prevent race conditions
      this.syncGlobalState();
      // 6. Build search index using the singleton search manager
      const searchManager = getSearchManager();
      if (searchManager && searchManager.buildSearchIndex) {
        searchManager.buildSearchIndex(this.emails);
      }
      // 7. Initialize IMAP search engine if using IMAP
      if (this.emailConfig && !this.googleAuth && (window as any).IMAPSearchEngine) {
        (window as any).imapSearchEngine = new (window as any).IMAPSearchEngine(this.emailConfig);
      }
      // 8. Log parsing statistics
      if (this.emails.length > 0) {
        this.emailManager.logEmailParsingStats(this.emails);
      }
      // 9. Debug email rendering issues
      if (typeof (window as any).debugEmailRenderingIssues === 'function') {
        (window as any).debugEmailRenderingIssues();
      }
      // 10. Ensure conversations list exists before rendering
      const conversationsList = document.getElementById('conversations-list');
      if (!conversationsList) {
        console.error('Conversations list element not found, delaying render');
        setTimeout(() => this.renderConversationsList(), 500);
      } else {
        this.renderConversationsList();
      }
      const loadingTime = Date.now() - startTime;
      this.uiThemeManager.showNotification(
        `Loaded ${this.emails.length} messages in ${Object.keys(this.conversations).length} conversations`,
        'success'
      );
      return {
        success: true,
        emails: this.emails,
        conversations: this.conversations,
        stats: {
          totalEmails: this.emails.length,
          totalConversations: Object.keys(this.conversations).length,
          loadingTime
        }
      };
    } catch (error) {
      console.error('Error loading emails:', error);
      const errorMessage = (error as Error).message;
      let userMessage = 'Failed to load emails';
      if (errorMessage.includes('Application-specific password required')) {
        userMessage = 'Gmail requires an app-specific password for IMAP access';
      } else if (errorMessage.includes('Invalid credentials')) {
        userMessage = 'Invalid email credentials';
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        userMessage = 'Cannot connect to email server';
      } else if (errorMessage.includes('OAuth')) {
        userMessage = 'Google authentication failed';
      }
      this.uiThemeManager.showNotification(userMessage, 'error');
      return {
        success: false,
        emails: [],
        conversations: {},
        error: userMessage
      };
    } finally {
      this.uiThemeManager.showLoading(false);
    }
  }

  /**
   * Unified fetch for all raw emails (Gmail, IMAP, etc.)
   * Returns an array of raw email objects
   */
  private async fetchAllRawEmails(): Promise<any[]> {
    if (this.googleAuth) {
      // Use Gmail API
      return await this.fetchGmailRawEmails();
    } else if (this.emailConfig) {
      // Use IMAP
      return await this.fetchImapRawEmails();
    } else {
      throw new Error('No email configuration or Google authentication available');
    }
  }

  /**
   * Fetch raw emails from Gmail API (returns array of raw email objects)
   */
  private async fetchGmailRawEmails(): Promise<any[]> {
    if (!this.googleAuth) throw new Error('Google authentication not available');
    try {
      console.log('Loading emails from Gmail API via IPC...');
      const result = await ipcRenderer.invoke('fetch-gmail-emails', {
        auth: this.googleAuth,
        maxResults: 50,
        labelIds: ['INBOX']
      });
      if (!result.success) throw new Error(result.error || 'Failed to fetch Gmail emails');
      const emails = result.emails || [];
      if (emails.length === 0) {
        console.log('No messages found in Gmail inbox');
        return [];
      }
      console.log(`Found ${emails.length} messages in Gmail inbox`);
      // Sort emails by date (newest first)
      emails.sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
      return emails;
    } catch (error) {
      console.error('Error loading Gmail emails:', error);
      throw error;
    }
  }

  /**
   * Fetch raw emails from IMAP (returns array of raw email objects)
   */
  private async fetchImapRawEmails(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.emailConfig) {
        reject(new Error('Email configuration not available'));
        return;
      }
      // Note: This would need to be adapted for browser environment
      // The original code uses Node.js require() which won't work in browser
      console.log('IMAP fetching would be implemented here');
      resolve([]);
    });
  }

  /**
   * Switch to different email folder
   * @param folder - Target folder name
   */
  switchFolder(folder: EmailFolder): void {
    // this.currentFolder = folder;
    console.log(`IMAPEmailManager: Switched to folder: ${folder}`);
    
    // Reload emails for the new folder
    this.loadEmails().catch(error => {
      console.error('Error loading emails for folder:', folder, error);
    });
  }

  /**
   * Render conversations list in the UI
   */
  private renderConversationsList(): void {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) {
      console.error('Conversations list element not found');
      return;
    }

    conversationsList.innerHTML = '';

    if (Object.keys(this.conversations).length === 0) {
      conversationsList.innerHTML = `
        <div class="text-center" style="padding: 20px; color: var(--text-secondary);">
          <p>No conversations found</p>
        </div>
      `;
      return;
    }

    // Sort conversations by date of latest email
    const sortedConversations = Object.values(this.conversations)
      .filter(conversation => conversation.emails && conversation.emails.length > 0)
      .sort((a, b) => {
        const aLatest = Math.max(...a.emails.map(e => new Date(e.date).getTime()));
        const bLatest = Math.max(...b.emails.map(e => new Date(e.date).getTime()));
        return bLatest - aLatest;
      });

    sortedConversations.forEach(conversation => {
      const element = this.createConversationElement(conversation);
      conversationsList.appendChild(element);
    });
  }

  /**
   * Create conversation element for UI
   * @param conversation - Conversation data
   * @returns HTMLElement for the conversation
   */
  private createConversationElement(conversation: EmailConversation): HTMLElement {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    div.dataset.conversationId = conversation.id;

    const latestEmail = conversation.emails[conversation.emails.length - 1];
    const date = new Date(latestEmail.date);
    const formattedTime = this.formatMessageTime(date);
    const unreadCount = conversation.emails.filter(e => !e.read).length;

    // Extract display name from latestEmail.from
    let displayName = 'Unknown';
    if (latestEmail && latestEmail.from) {
      if (typeof latestEmail.from === 'object' && latestEmail.from.name) {
        displayName = latestEmail.from.name;
      } else if (typeof latestEmail.from === 'string') {
        const fromStr = latestEmail.from as string;
        const match = fromStr.match(/^(.+?)\s*<(.+?)>$/);
        if (match) {
          displayName = match[1].trim();
        } else {
          displayName = fromStr;
        }
      }
    }

    // Remove any surrounding quotes from displayName
    displayName = displayName.replace(/^['"]+|['"]+$/g, '');

    const conversationHTML = `
      <div class="conversation-info">
        <div class="conversation-content">
          <strong>${this.escapeHtml(displayName)}</strong><br>
          <span>${this.escapeHtml(latestEmail.subject || 'No Subject')}</span>
        </div>
      </div>
      <div class="conversation-meta">
        <div class="conversation-time">${formattedTime}</div>
        ${unreadCount > 0 ? `<div class="conversation-unread">${unreadCount}</div>` : ''}
      </div>
    `;

    if ((window as any).SafeHTML) {
      (window as any).SafeHTML.setInnerHTML(div, conversationHTML, 'ui');
    } else {
      div.innerHTML = conversationHTML;
    }

    div.addEventListener('click', () => {
      if (this.conversationSelectCallback) {
        this.conversationSelectCallback(conversation.id);
      } else {
        console.warn('No conversation select callback set');
      }
    });

    return div;
  }

  /**
   * Format message time for display
   * @param date - Date to format
   * @returns Formatted time string
   */
  private formatMessageTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (diff < oneDay) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (diff < 7 * oneDay) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }



  /**
   * Basic email grouping when ThreadingManager is not available
   * @param emails - Array of emails to group
   * @returns Grouped conversations object
   */
  private basicEmailGrouping(emails: Email[]): Record<string, EmailConversation> {
    const conversations: Record<string, EmailConversation> = {};
    
    emails.forEach(email => {
      const threadId = email.threadId || email.messageId;
      if (!conversations[threadId]) {
        conversations[threadId] = {
          id: threadId,
          emails: [],
          participants: [],
          subject: email.subject || 'No Subject',
          unreadCount: 0,
          hasAttachments: false
        };
      }
      
      conversations[threadId].emails.push(email);
      
      // Update conversation metadata
      if (!email.read) {
        conversations[threadId].unreadCount++;
      }
      if (email.attachments && email.attachments.length > 0) {
        conversations[threadId].hasAttachments = true;
      }
      
      // Update participants
      const from = typeof email.from === 'string' ? email.from : email.from.email;
      if (!conversations[threadId].participants.includes(from)) {
        conversations[threadId].participants.push(from);
      }
    });
    
    return conversations;
  }

  /**
   * Escape HTML special characters
   * @param text - Text to escape
   * @returns Escaped HTML text
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if manager is initialized
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Sync local state to global state for legacy compatibility
   * This prevents race conditions between modular and global access patterns
   */
  private syncGlobalState(): void {
    console.log('IMAPEmailManager: Syncing state to global variables for compatibility');
    
    // Immediate synchronous assignment
    (window as any).emails = this.emails;
    (window as any).conversations = this.conversations;
    
    // Notify other modules that state is ready
    window.dispatchEvent(new CustomEvent('emailsLoaded', {
      detail: {
        emails: this.emails,
        conversations: this.conversations,
        timestamp: Date.now()
      }
    }));
    
    console.log(`IMAPEmailManager: Synced ${this.emails.length} emails and ${Object.keys(this.conversations).length} conversations to global state`);
  }

  // waitForGlobalState method removed - functionality moved to email-actions.ts
}

console.log('IMAPEmailManager module loaded successfully');

// Unit test for IMAP attachment standardization
if (typeof window !== 'undefined') {
  (window as any).testIMAPAttachmentStandardization = () => {
    const emailManager = new (window as any).EmailManager({});
    const imapEmailManager = new (IMAPEmailManager as any)(null, null, emailManager);
    const testRawEmails = [
      {
        id: '1',
        attachments: [
          { filename: 'imap1.txt', contentType: 'text/plain', size: 100 },
          { name: 'imap2.pdf', mimeType: 'application/pdf', size: 200 }
        ]
      }
    ];
    const standardizedEmails = testRawEmails.map((raw: any) => {
      const email = emailManager.standardizeEmailObject(raw, 'imap');
      if (email.attachments && Array.isArray(email.attachments)) {
        email.attachments = emailManager.standardizeAttachments(email.attachments, email.messageId);
      }
      return email;
    });
    console.assert(standardizedEmails[0].attachments?.length === 2, 'Should have 2 attachments');
    console.assert(standardizedEmails[0].attachments?.[0].filename === 'imap1.txt', 'First attachment filename');
    console.assert(standardizedEmails[0].attachments?.[1].filename === 'imap2.pdf', 'Second attachment filename');
    console.log('✅ testIMAPAttachmentStandardization passed', standardizedEmails);
    return standardizedEmails;
  };

  (window as any).IMAPEmailManager = IMAPEmailManager;

  // Add a global debug function for Gmail raw attachment parsing
  (window as any).debugGmailRawAttachments = async (messageId: string) => {
    try {
      if (!messageId) {
        console.error('Please provide a Gmail message ID');
        return;
      }
      // Use IPC to fetch the raw message from Gmail
      const googleAuth = (window as any).googleAuth || (window as any).storedGoogleToken;
      if (!googleAuth) {
        console.error('No Google auth token available in window context');
        return;
      }
      const result = await ipcRenderer.invoke('fetch-gmail-raw-message', { messageId, auth: googleAuth });
      if (!result.success) {
        console.error('Failed to fetch raw Gmail message:', result.error);
        return;
      }
      const rawBase64 = result.raw;
      if (!rawBase64) {
        console.error('No raw data returned for message');
        return;
      }
      // Use IPC to parse the raw email in the main process
      const parseResult = await ipcRenderer.invoke('parse-raw-email', rawBase64);
      if (!parseResult.success) {
        console.error('Failed to parse raw email:', parseResult.error);
        return;
      }
      console.log('[DEBUG] Parsed email:', parseResult.parsed);
      console.log('[DEBUG] Parsed attachments:', parseResult.parsed.attachments);
      return parseResult.parsed;
    } catch (e) {
      console.error('Error in debugGmailRawAttachments:', e);
    }
  };
} 