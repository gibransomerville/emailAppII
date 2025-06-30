/**
 * Email Composer Module
 * Handles all email composition, sending, and draft functionality
 */

// Import Electron modules conditionally for browser compatibility
let ipcRenderer: any;
if (typeof window !== 'undefined' && (window as any).require) {
  // In Electron renderer process
  const electron = (window as any).require('electron');
  ipcRenderer = electron.ipcRenderer;
} else {
  // In browser environment, create a mock or use global
  ipcRenderer = (window as any).ipcRenderer || {
    invoke: async (channel: string, ...args: any[]) => {
      console.warn(`IPC invoke called in browser: ${channel}`, args);
      return { success: false, error: 'IPC not available in browser' };
    },
    on: (channel: string, callback: Function) => {
      console.warn(`IPC on called in browser: ${channel}`);
      // Store callback for potential future use
      (window as any).ipcCallbacks = (window as any).ipcCallbacks || {};
      (window as any).ipcCallbacks[channel] = callback;
    }
  };
}

import { EmailConfig } from '../../types/config';
import { Email } from '../../types/email';

interface EmailData {
    to: string;
    cc?: string;
    subject: string;
    body: string;
}

interface SendMailInfo {
    messageId: string;
    response: string;
}

interface GmailSendResponse {
    id: string;
    threadId: string;
}

class EmailComposer {
    private emailConfig: EmailConfig | null;
    private googleAuth: any;
    private initialized: boolean;

    constructor() {
        this.emailConfig = null;
        this.googleAuth = null;
        this.initialized = false;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize(): void {
        console.log('EmailComposer: Initializing...');
        this.setupEventListeners();
        this.initialized = true;
        console.log('EmailComposer: Initialized successfully');
    }

    setEmailConfig(config: EmailConfig): void {
        this.emailConfig = config;
        console.log('EmailComposer: Email config updated');
    }

    setGoogleAuth(authToken: any): void {
        this.googleAuth = authToken;
        console.log('EmailComposer: Google auth token updated');
    }

    setupEventListeners(): void {
        if (ipcRenderer) {
            ipcRenderer.on('new-email', () => {
                this.showComposeModal();
            });
            console.log('EmailComposer: IPC event listeners setup successfully');
        } else {
            console.warn('EmailComposer: ipcRenderer not available, IPC events disabled');
        }
    }

    showComposeModal(): void {
        const showComposeModal = (globalThis as any).showComposeModal || (window as any).showComposeModal;
        if (showComposeModal) {
            showComposeModal();
        } else {
            console.warn('showComposeModal function not available');
        }
    }

    hideComposeModal(): void {
        const hideComposeModal = (globalThis as any).hideComposeModal || (window as any).hideComposeModal;
        if (hideComposeModal) {
            hideComposeModal();
        } else {
            console.warn('hideComposeModal function not available');
        }
    }

    async sendEmail(): Promise<void> {
        const emailData: EmailData = {
            to: (document.getElementById('to-input') as HTMLInputElement)?.value || '',
            cc: (document.getElementById('cc-input') as HTMLInputElement)?.value || '',
            subject: (document.getElementById('subject-input') as HTMLInputElement)?.value || '',
            body: (document.getElementById('body-input') as HTMLTextAreaElement)?.value || ''
        };
        
        if (!emailData.to || !emailData.subject || !emailData.body) {
            const showNotification = (globalThis as any).showNotification || (window as any).showNotification;
            if (showNotification) {
                showNotification('Please fill in all required fields', 'warning');
            }
            return;
        }
        
        const showLoading = (globalThis as any).showLoading || (window as any).showLoading;
        if (showLoading) {
            showLoading(true);
        }
        
        try {
            if (this.googleAuth) {
                console.log('Sending email via Gmail API...');
                await this.sendEmailViaGmail(emailData);
            } else if (this.emailConfig) {
                console.log('Sending email via SMTP...');
                await this.sendEmailViaSmtp(emailData);
            } else {
                throw new Error('No email configuration available. Please configure SMTP settings or sign in with Google.');
            }
            
            this.hideComposeModal();
            const showNotification = (globalThis as any).showNotification || (window as any).showNotification;
            if (showNotification) {
                showNotification('Email sent successfully!', 'success');
            }
            
            const loadEmails = (globalThis as any).loadEmails || (window as any).loadEmails;
            if (loadEmails) {
                await loadEmails();
            }
        } catch (error) {
            console.error('Error sending email:', error);
            const showNotification = (globalThis as any).showNotification || (window as any).showNotification;
            if (showNotification) {
                showNotification(`Failed to send email: ${(error as Error).message}`, 'error');
            }
        } finally {
            if (showLoading) {
                showLoading(false);
            }
        }
    }

    sendEmailViaSmtp(emailData: EmailData): Promise<SendMailInfo> {
        return new Promise((resolve, reject) => {
            if (!this.emailConfig) {
                reject(new Error('SMTP configuration not available'));
                return;
            }

            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransporter({
                host: this.emailConfig.smtpHost,
                port: this.emailConfig.smtpPort,
                secure: this.emailConfig.smtpPort === 465,
                auth: {
                    user: this.emailConfig.email,
                    pass: this.emailConfig.password
                }
            });
            
            const mailOptions = {
                from: this.emailConfig.email,
                to: emailData.to,
                cc: emailData.cc || undefined,
                subject: emailData.subject,
                text: emailData.body
            };
            
            transporter.sendMail(mailOptions, (error: Error | null, info: SendMailInfo) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(info);
                }
            });
        });
    }

    async sendEmailViaGmail(emailData: EmailData): Promise<GmailSendResponse> {
        if (!this.googleAuth) {
            throw new Error('Google authentication not available');
        }
        
        try {
            console.log('EmailComposer: Sending email via Gmail API using IPC...');
            
            // Use IPC to send email in main process where googleapis is available
            const result = await ipcRenderer.invoke('send-gmail-email', {
                to: emailData.to,
                cc: emailData.cc,
                subject: emailData.subject,
                body: emailData.body,
                auth: this.googleAuth
            });
            
            if (result.success) {
                console.log('Email sent successfully via Gmail API:', result.data);
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to send email');
            }
            
        } catch (error: any) {
            console.error('Gmail API send error:', error);
            
            // Map error codes from main process
            if (error.message.includes('403') || error.message.includes('access denied')) {
                throw new Error('Gmail API access denied. Please ensure you have the gmail.send scope enabled.');
            } else if (error.message.includes('429') || error.message.includes('quota exceeded')) {
                throw new Error('Gmail API quota exceeded. Please try again later.');
            } else if (error.message.includes('401') || error.message.includes('authentication expired')) {
                throw new Error('Gmail authentication expired. Please sign in with Google again.');
            } else {
                throw new Error(`Gmail API error: ${error.message}`);
            }
        }
    }

    findEmailByMessageId(messageId: string): Email | null {
        const emails = (globalThis as any).emails || (window as any).emails;
        if (!emails || !Array.isArray(emails)) {
            console.warn('Emails array not available');
            return null;
        }

        return emails.find((email: Email) => 
            email.id === messageId || 
            email.messageId === messageId ||
            email.id === messageId.toString() ||
            email.messageId === messageId.toString()
        ) || null;
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}

// Singleton pattern - proper modular approach
let emailComposerInstance: EmailComposer | null = null;

export function getEmailComposer(): EmailComposer {
    if (!emailComposerInstance) {
        emailComposerInstance = new EmailComposer();
    }
    return emailComposerInstance;
}

// Function implementations that use the singleton
export async function sendEmail(): Promise<void> {
    const emailComposer = getEmailComposer();
    
    const emailConfig = (globalThis as any).emailConfig || (window as any).emailConfig;
    const googleAuth = (globalThis as any).googleAuth || (window as any).googleAuth;
    
    if (emailConfig) {
        emailComposer.setEmailConfig(emailConfig);
    }
    if (googleAuth) {
        emailComposer.setGoogleAuth(googleAuth);
    }
    
    return await emailComposer.sendEmail();
}

export function sendEmailViaSmtp(emailData: EmailData): Promise<SendMailInfo> {
    const emailComposer = getEmailComposer();
    
    const emailConfig = (globalThis as any).emailConfig || (window as any).emailConfig;
    if (emailConfig) {
        emailComposer.setEmailConfig(emailConfig);
    }
    return emailComposer.sendEmailViaSmtp(emailData);
}

export async function sendEmailViaGmail(emailData: EmailData): Promise<GmailSendResponse> {
    const emailComposer = getEmailComposer();
    
    const googleAuth = (globalThis as any).googleAuth || (window as any).googleAuth;
    if (googleAuth) {
        emailComposer.setGoogleAuth(googleAuth);
    }
    return await emailComposer.sendEmailViaGmail(emailData);
}

export function findEmailByMessageId(messageId: string): Email | null {
    const emailComposer = getEmailComposer();
    return emailComposer.findEmailByMessageId(messageId);
}

export {
    EmailComposer,
    type EmailData,
    type SendMailInfo,
    type GmailSendResponse
};

// Legacy browser compatibility (minimal global exposure)
if (typeof window !== 'undefined') {
    (window as any).EmailComposer = EmailComposer;
    (window as any).getEmailComposer = getEmailComposer;
    (window as any).sendEmail = sendEmail;
    (window as any).sendEmailViaSmtp = sendEmailViaSmtp;
    (window as any).sendEmailViaGmail = sendEmailViaGmail;
    (window as any).findEmailByMessageId = findEmailByMessageId;
}

console.log('EmailComposer module loaded successfully');
