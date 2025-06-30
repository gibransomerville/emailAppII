/**
 * Email Actions Module
 * Handles email interactions, actions, and user operations
 * Dependencies: EmailRenderer, SafeHTML, global variables (conversations, emails, emailConfig, etc.)
 */

import type { Email, EmailAddress, EmailConversation } from '../../types/email';

/**
 * Email action types
 */
export type EmailAction = 
  | 'reply' 
  | 'reply-all' 
  | 'forward' 
  | 'expand' 
  | 'collapse' 
  | 'display';

/**
 * Email action result interface
 */
export interface EmailActionResult {
  success: boolean;
  action: EmailAction;
  emailId?: string;
  error?: string;
  data?: any;
}

/**
 * Email lookup result interface
 */
export interface EmailLookupResult {
  email: Email | null;
  conversationId?: string;
  found: boolean;
}

/**
 * Email expansion state interface
 */
export interface EmailExpansionState {
  isExpanded: boolean;
  hasContent: boolean;
  contentElement?: HTMLElement;
}

/**
 * Compose form data interface
 */
export interface ComposeFormData {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

/**
 * EmailActions - Centralized email interaction and action management
 */
const EmailActions = {
  /**
   * Validate that required dependencies are available
   * @returns True if all dependencies are available
   */
  validateDependencies(): boolean {
    const missing: string[] = [];
    
    if (typeof (window as any).EmailRenderer === 'undefined') {
      missing.push('EmailRenderer');
    }
    
    if (typeof (window as any).SafeHTML === 'undefined') {
      missing.push('SafeHTML');
    }
    
    if (missing.length > 0) {
      console.error('EmailActions module missing dependencies:', missing);
      return false;
    }
    
    return true;
  },

  /**
   * Wait for global email state to be ready
   * This prevents race conditions between modular loading and global state access
   */
  async waitForEmailState(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).emails && (window as any).conversations) {
        resolve();
        return;
      }
      
      const handler = () => {
        window.removeEventListener('emailsLoaded', handler);
        resolve();
      };
      
      window.addEventListener('emailsLoaded', handler);
      
      // Timeout fallback
      setTimeout(() => {
        window.removeEventListener('emailsLoaded', handler);
        console.warn('EmailActions: Timeout waiting for email state, proceeding anyway');
        resolve();
      }, 5000);
    });
  },

  /**
   * Find email by message ID (with state validation)
   * @param messageId - Message ID to search for
   * @returns Email object or null if not found
   */
  async findEmailByMessageId(messageId: string): Promise<Email | null> {
    // Wait for email state to be ready
    await this.waitForEmailState();
    
    const conversations = (window as any).conversations || {};
    
    for (const conversation of Object.values(conversations) as EmailConversation[]) {
      if (conversation.emails) {
        const email = conversation.emails.find((e: Email) => e.messageId === messageId || e.id === messageId);
        if (email) {
          return email;
        }
      }
    }
    
    return null;
  },

  /**
   * Toggle email expansion/collapse
   * @param messageId - Message ID of email to toggle
   */
  async toggleEmailExpansion(messageId: string): Promise<EmailActionResult> {
    console.log('EmailActions.toggleEmailExpansion called with messageId:', messageId);
    
    // Validate messageId
    if (!messageId) {
      console.error('Invalid messageId provided:', messageId);
      return { success: false, action: 'expand', error: 'Invalid messageId' };
    }
    
    const emailItem = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
    if (!emailItem) {
      console.error('Email item not found for messageId:', messageId);
      return { success: false, action: 'expand', error: 'Email item not found' };
    }
    
    const isCurrentlyExpanded = emailItem.classList.contains('expanded');
    
    if (isCurrentlyExpanded) {
      // Collapse the email
      emailItem.classList.remove('expanded');
      
      // Remove Gmail expanded content
      const expandedContent = emailItem.querySelector('.gmail-expanded-content');
      if (expandedContent) {
        expandedContent.remove();
      }
      
      // Update preview text
      const emailPreview = emailItem.querySelector('.gmail-thread-preview');
      if (emailPreview) {
        const email = await this.findEmailByMessageId(messageId);
        if (email) {
          const EmailRenderer = (window as any).EmailRenderer;
          const truncatedPreview = EmailRenderer.generatePreviewText(email, 80);
          emailPreview.textContent = truncatedPreview;
        }
      }
      
      return { success: true, action: 'collapse', emailId: messageId };
    } else {
      // Expand the email
      emailItem.classList.add('expanded');
      
      const email = await this.findEmailByMessageId(messageId);
      if (!email) {
        console.error('No email found for messageId:', messageId);
        return { success: false, action: 'expand', error: 'Email not found' };
      }
      
      try {
        const senderName = email.from ? 
          (email.from.name || email.from.email || email.from) : 'Unknown Sender';
        const senderEmail = email.from ? 
          (email.from.email || email.from) : '';
        
        const toList = Array.isArray(email.to) ? email.to : [email.to].filter(Boolean);
        const ccList = Array.isArray(email.cc) ? email.cc : [email.cc].filter(Boolean);
        
        const EmailRenderer = (window as any).EmailRenderer;
        const expandedContent = EmailRenderer.createGmailExpandedContent(email, senderName, senderEmail, toList, ccList);
        emailItem.appendChild(expandedContent);
        
        const emailPreview = emailItem.querySelector('.gmail-thread-preview');
        if (emailPreview) {
          emailPreview.textContent = 'Click to collapse';
        }
        
        return { success: true, action: 'expand', emailId: messageId };
      } catch (error) {
        console.error('Error expanding email:', error);
        return { success: false, action: 'expand', error: (error as Error).message };
      }
    }
  },

  /**
   * Reply to specific email
   * @param messageId - Message ID of email to reply to
   */
  async replyToEmail(messageId: string): Promise<EmailActionResult> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) {
      return { success: false, action: 'reply', error: 'Email not found' };
    }
    const showComposeModal = (window as any).showComposeModal;
    
    if (email && typeof showComposeModal !== 'undefined') {
      showComposeModal();
      
      const toInput = document.getElementById('to-input') as HTMLInputElement;
      const subjectInput = document.getElementById('subject-input') as HTMLInputElement;
      const bodyInput = document.getElementById('body-input') as HTMLTextAreaElement;
      
      if (toInput) toInput.value = getEmailString(email.from);
      if (subjectInput) subjectInput.value = 'RE: ' + (email.subject || '');
      if (bodyInput) {
        const EmailRenderer = (window as any).EmailRenderer;
        bodyInput.value = `\n\n--- Original Message ---\nFrom: ${getEmailString(email.from)}\nSent: ${EmailRenderer.formatDetailedDate(email.date)}\nSubject: ${email.subject}\n\n${email.bodyText || email.body || ''}`;
      }
      
      return { success: true, action: 'reply', emailId: messageId };
    }
    
    return { success: false, action: 'reply', error: 'Compose modal not available' };
  },

  /**
   * Reply to all recipients of email
   * @param messageId - Message ID of email to reply to
   */
  async replyAllToEmail(messageId: string): Promise<EmailActionResult> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) {
      return { success: false, action: 'reply-all', error: 'Email not found' };
    }
    const showComposeModal = (window as any).showComposeModal;
    
    if (email && typeof showComposeModal !== 'undefined') {
      showComposeModal();
      
      const allRecipients: string[] = [getEmailString(email.from)];
      
      if (email.to) {
        const toRecipients = Array.isArray(email.to) ? 
          email.to.map((t: EmailAddress | string) => getEmailString(t)) : 
          [email.to];
        allRecipients.push(...toRecipients);
      }
      
      if (email.cc) {
        const ccRecipients = Array.isArray(email.cc) ? 
          email.cc.map((c: EmailAddress | string) => getEmailString(c)) : 
          [email.cc];
        allRecipients.push(...ccRecipients);
      }
      
      const toInput = document.getElementById('to-input') as HTMLInputElement;
      const subjectInput = document.getElementById('subject-input') as HTMLInputElement;
      const bodyInput = document.getElementById('body-input') as HTMLTextAreaElement;
      
      if (toInput) toInput.value = allRecipients.join(', ');
      if (subjectInput) subjectInput.value = 'RE: ' + (email.subject || '');
      if (bodyInput) {
        const EmailRenderer = (window as any).EmailRenderer;
        bodyInput.value = `\n\n--- Original Message ---\nFrom: ${getEmailString(email.from)}\nSent: ${EmailRenderer.formatDetailedDate(email.date)}\nSubject: ${email.subject}\n\n${email.bodyText || email.body || ''}`;
      }
      
      return { success: true, action: 'reply-all', emailId: messageId };
    }
    
    return { success: false, action: 'reply-all', error: 'Compose modal not available' };
  },

  /**
   * Forward email
   * @param messageId - Message ID of email to forward
   */
  async forwardEmail(messageId: string): Promise<EmailActionResult> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) {
      return { success: false, action: 'forward', error: 'Email not found' };
    }
    const showComposeModal = (window as any).showComposeModal;
    
    if (email && typeof showComposeModal !== 'undefined') {
      showComposeModal();
      
      const subjectInput = document.getElementById('subject-input') as HTMLInputElement;
      const bodyInput = document.getElementById('body-input') as HTMLTextAreaElement;
      
      if (subjectInput) subjectInput.value = 'FW: ' + (email.subject || '');
      if (bodyInput) {
        const EmailRenderer = (window as any).EmailRenderer;
        const toRecipients = Array.isArray(email.to) ? 
          email.to.map((t: EmailAddress | string) => getEmailString(t)).join(', ') : 
          email.to;
        bodyInput.value = `\n\n--- Forwarded Message ---\nFrom: ${getEmailString(email.from)}\nSent: ${EmailRenderer.formatDetailedDate(email.date)}\nTo: ${toRecipients}\nSubject: ${email.subject}\n\n${email.bodyText || email.body || ''}`;
      }
      
      return { success: true, action: 'forward', emailId: messageId };
    }
    
    return { success: false, action: 'forward', error: 'Compose modal not available' };
  },

  /**
   * Check if email was sent by current user
   * @param email - Email object to check
   * @returns True if email was sent by user
   */
  isEmailSent(email: Email): boolean {
    const emailConfig = (window as any).emailConfig;
    if (emailConfig && emailConfig.email) {
      return email.from?.email?.includes(emailConfig.email) || false;
    }
    
    const storedGoogleToken = (window as any).storedGoogleToken;
    if (storedGoogleToken) {
      return email.folder === 'sent' || email.labels?.includes('SENT') || false;
    }
    
    return false;
  },

  /**
   * Display individual email in email view
   * @param emailId - Email ID to display
   */
  displayEmail(emailId: string): EmailActionResult {
    const emails = (window as any).emails;
    if (!emails) {
      console.error('emails array not available');
      return { success: false, action: 'display', error: 'Emails array not available' };
    }
    
    const email = emails.find((e: Email) => e.id === emailId);
    if (!email) {
      return { success: false, action: 'display', error: 'Email not found' };
    }

    const date = new Date(email.date);
    const formattedDate = date.toLocaleString();

    let emailBody = email.body || '';
    
    const EmailRenderer = (window as any).EmailRenderer;
    if (email.bodyHtml) {
      emailBody = EmailRenderer.sanitizeAndStyleHtml(emailBody);
    } else {
      emailBody = EmailRenderer.convertPlainTextToHtml(emailBody);
    }

    const emailView = (window as any).emailView;
    if (emailView) {
      emailView.innerHTML = `
        <div class="email-header">
          <h2>${EmailRenderer.escapeHtml(email.subject || '(No Subject)')}</h2>
          <div class="email-meta">
            <div class="email-from">
              <strong>From:</strong> ${EmailRenderer.escapeHtml(getEmailString(email.from))}
            </div>
            <div class="email-to">
              <strong>To:</strong> ${EmailRenderer.escapeHtml(Array.isArray(email.to) ? email.to.map((t: EmailAddress | string) => getEmailString(t)).join(', ') : getEmailString(email.to))}
            </div>
            <div class="email-date">
              <strong>Date:</strong> ${formattedDate}
            </div>
          </div>
        </div>
        <div class="email-body">
          ${emailBody}
        </div>
      `;
      
      return { success: true, action: 'display', emailId, data: { email } };
    }
    
    return { success: false, action: 'display', error: 'Email view not available' };
  }
};

// Legacy function wrappers for backward compatibility - now async
async function findEmailByMessageId(messageId: string): Promise<Email | null> {
  return EmailActions.findEmailByMessageId(messageId);
}

async function toggleEmailExpansion(messageId: string): Promise<EmailActionResult> {
  return EmailActions.toggleEmailExpansion(messageId);
}

async function replyToEmail(messageId: string): Promise<EmailActionResult> {
  return EmailActions.replyToEmail(messageId);
}

async function replyAllToEmail(messageId: string): Promise<EmailActionResult> {
  return EmailActions.replyAllToEmail(messageId);
}

async function forwardEmail(messageId: string): Promise<EmailActionResult> {
  return EmailActions.forwardEmail(messageId);
}

function isEmailSent(email: Email): boolean {
  return EmailActions.isEmailSent(email);
}

function displayEmail(emailId: string): EmailActionResult {
  return EmailActions.displayEmail(emailId);
}

// Browser-compatible module loading
if (typeof window !== 'undefined') {
  (window as any).EmailActions = EmailActions;
  (window as any).findEmailByMessageId = findEmailByMessageId;
  (window as any).toggleEmailExpansion = toggleEmailExpansion;
  (window as any).replyToEmail = replyToEmail;
  (window as any).replyAllToEmail = replyAllToEmail;
  (window as any).forwardEmail = forwardEmail;
  (window as any).isEmailSent = isEmailSent;
  (window as any).displayEmail = displayEmail;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (EmailActions.validateDependencies()) {
        console.log('EmailActions module loaded and dependencies validated');
      }
    });
  } else {
    if (EmailActions.validateDependencies()) {
      console.log('EmailActions module loaded and dependencies validated');
    }
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    EmailActions, 
    findEmailByMessageId, 
    toggleEmailExpansion, 
    replyToEmail, 
    replyAllToEmail, 
    forwardEmail, 
    isEmailSent, 
    displayEmail 
  };
}

// Helper to extract string from EmailAddress or string
function getEmailString(val: string | { email?: string; name?: string } | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if ('email' in val && val.email) return val.email;
  if ('name' in val && val.name) return val.name;
  return '';
} 