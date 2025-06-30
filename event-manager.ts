/**
 * Event Manager Module
 * Handles all event listeners, UI interactions, keyboard shortcuts,
 * and user interface event management
 * 
 * Dependencies:
 * - UIThemeManager (modal management, loading states, notifications)
 * - EmailComposer (compose functionality)
 * - SettingsManager (settings management)
 * - IMAPEmailManager (email loading)
 * - AuthManager (OAuth functionality)
 * - SafeHTML (secure HTML rendering)
 * - EmailRenderer (email rendering)
 * - MarketingEmailDetector (marketing email detection)
 * 
 * @author Email App Modular Architecture
 * @version 1.0.0
 */

import { Email } from './types/email.js';
import { AuthManager } from './auth-manager.js';
import { uiThemeManager } from './ui-theme-manager.js';
import { EmailComposer } from './email-composer.js';
import { IMAPEmailManager } from './imap-email-manager.js';
import { EmailRenderer } from './email-renderer.js';
import { MarketingEmailDetector } from './marketing-email-detector.js';

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
    }
  };
}

interface DOMElements {
    composeBtn: HTMLElement | null;
    settingsBtn: HTMLElement | null;
    refreshBtn: HTMLElement | null;
    messageInput: HTMLTextAreaElement | null;
    sendMessageBtn: HTMLButtonElement | null;
    composeModal: HTMLElement | null;
    settingsModal: HTMLElement | null;
    closeComposeBtn: HTMLElement | null;
    closeSettingsBtn: HTMLElement | null;
    composeForm: HTMLFormElement | null;
    saveDraftBtn: HTMLElement | null;
    settingsForm: HTMLFormElement | null;
    oauthCancelBtn: HTMLElement | null;
    googleSSOBtn: HTMLElement | null;
    microsoftSSOBtn: HTMLElement | null;
}

interface SSOResult {
    success: boolean;
    token?: string;
    error?: string;
}

interface ConversationData {
    safeId?: string;
    [key: string]: any;
}

class EventManager {
    private initialized: boolean;
    public oauthCancelRequested: boolean;
    private domElements: DOMElements;
    private emailComposer: EmailComposer;
    private imapEmailManager: IMAPEmailManager;
    private emailRenderer: EmailRenderer;
    private marketingEmailDetector: MarketingEmailDetector;

    constructor(emailComposer: EmailComposer, imapEmailManager: IMAPEmailManager, emailRenderer: EmailRenderer, marketingEmailDetector: MarketingEmailDetector) {
        this.initialized = false;
        this.oauthCancelRequested = false;
        this.domElements = {} as DOMElements;
        this.emailComposer = emailComposer;
        this.imapEmailManager = imapEmailManager;
        this.emailRenderer = emailRenderer;
        this.marketingEmailDetector = marketingEmailDetector;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    /**
     * Initialize the Event Manager
     */
    initialize(): void {
        console.log('EventManager: Initializing...');
        this.cacheDOMElements();
        this.setupEventListeners();
        this.initialized = true;
        console.log('EventManager: Initialized successfully');
    }

    /**
     * Cache DOM elements for better performance
     */
    private cacheDOMElements(): void {
        this.domElements = {
            composeBtn: document.getElementById('compose-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            refreshBtn: document.getElementById('refresh-btn'),
            messageInput: document.getElementById('message-input') as HTMLTextAreaElement,
            sendMessageBtn: document.getElementById('send-message-btn') as HTMLButtonElement,
            composeModal: document.getElementById('compose-modal'),
            settingsModal: document.getElementById('settings-modal'),
            closeComposeBtn: document.getElementById('close-compose'),
            closeSettingsBtn: document.getElementById('close-settings'),
            composeForm: document.getElementById('compose-form') as HTMLFormElement,
            saveDraftBtn: document.getElementById('save-draft-btn'),
            settingsForm: document.getElementById('settings-form') as HTMLFormElement,
            oauthCancelBtn: document.getElementById('oauth-cancel-btn'),
            googleSSOBtn: document.getElementById('google-sso-btn'),
            microsoftSSOBtn: document.getElementById('microsoft-sso-btn')
        };
        
        // Debug: Log which elements were found
        console.log('EventManager DOM elements cached:');
        Object.entries(this.domElements).forEach(([key, element]) => {
            console.log(`  ${key}:`, !!element);
        });
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners(): void {
        console.log('Setting up event listeners...');
        
        this.setupButtonListeners();
        this.setupModalListeners();
        this.setupFormListeners();
        this.setupMessageInputListeners();
        this.setupKeyboardShortcuts();
        this.setupThemeListeners();
        this.setupSSOListeners();
        this.setupSearchManager();
        this.setupEmailActionDelegation();
        
        console.log('All event listeners setup completed');
    }

    /**
     * Setup button event listeners
     */
    private setupButtonListeners(): void {
        // Compose button
        if (this.domElements.composeBtn) {
            this.domElements.composeBtn.addEventListener('click', () => {
                console.log('Compose button clicked');
                uiThemeManager.showComposeModal();
            });
            console.log('Compose button listener attached');
        } else {
            console.error('Compose button not found');
        }

        // Settings button - SINGLE RESPONSIBILITY OWNER
        console.log('EventManager: Looking for settings button...');
        console.log('EventManager: this.domElements.settingsBtn:', this.domElements.settingsBtn);
        
        if (this.domElements.settingsBtn) {
            console.log('EventManager: Settings button found, attaching listener (SINGLE OWNER)');
            console.log('EventManager: Button element:', this.domElements.settingsBtn);
            console.log('EventManager: Button classes:', this.domElements.settingsBtn.className);
            console.log('EventManager: Button parent:', this.domElements.settingsBtn.parentElement);
            
            // Remove any existing listeners first
            this.domElements.settingsBtn.replaceWith(this.domElements.settingsBtn.cloneNode(true));
            this.domElements.settingsBtn = document.getElementById('settings-btn') as HTMLElement;
            
            console.log('EventManager: Button after refresh:', this.domElements.settingsBtn);
            
            this.domElements.settingsBtn.addEventListener('click', (e: Event) => {
                console.log('=== EventManager: Settings button clicked ===');
                e.preventDefault();
                e.stopPropagation();
                
                console.log('EventManager: About to call showSettingsModal');
                console.log('EventManager: uiThemeManager available:', !!uiThemeManager);
                console.log('EventManager: showSettingsModal function:', typeof uiThemeManager.showSettingsModal);
                
                try {
                    uiThemeManager.showSettingsModal();
                    console.log('EventManager: showSettingsModal called successfully');
                } catch (error) {
                    console.error('EventManager: Error calling showSettingsModal:', error);
                }
            });
            
            console.log('EventManager: Settings button listener attached (clean)');
        } else {
            console.error('EventManager: Settings button not found in domElements');
            
            // Try direct search as fallback
            const directSearch = document.getElementById('settings-btn');
            console.log('EventManager: Direct search result:', directSearch);
            
            if (directSearch) {
                console.log('EventManager: Found settings button via direct search, attaching listener');
                directSearch.addEventListener('click', (e: Event) => {
                    console.log('=== EventManager: Settings button clicked (direct search) ===');
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('EventManager: About to call showSettingsModal');
                    console.log('EventManager: uiThemeManager available:', !!uiThemeManager);
                    console.log('EventManager: showSettingsModal function:', typeof uiThemeManager.showSettingsModal);
                    
                    try {
                        uiThemeManager.showSettingsModal();
                        console.log('EventManager: showSettingsModal called successfully');
                    } catch (error) {
                        console.error('EventManager: Error calling showSettingsModal:', error);
                    }
                });
                console.log('EventManager: Settings button listener attached via direct search');
            }
        }

        // Refresh button
        if (this.domElements.refreshBtn) {
            this.domElements.refreshBtn.addEventListener('click', async () => {
                console.log('Refresh button clicked');
                await this.imapEmailManager.loadEmails();
            });
            console.log('Refresh button listener attached');
        } else {
            console.error('Refresh button not found');
        }

        // Send message button
        if (this.domElements.sendMessageBtn) {
            this.domElements.sendMessageBtn.addEventListener('click', async () => {
                await this.emailComposer.sendEmail();
            });
            console.log('Send message button listener attached');
        } else {
            console.error('Send message button not found');
        }

        // Save draft button
        if (this.domElements.saveDraftBtn) {
            this.domElements.saveDraftBtn.addEventListener('click', () => {
                console.log('Save draft button clicked');
                // TODO: Implement save draft functionality
            });
            console.log('Save draft button listener attached');
        } else {
            console.error('Save draft button not found');
        }

        // OAuth cancel button
        if (this.domElements.oauthCancelBtn) {
            this.domElements.oauthCancelBtn.addEventListener('click', () => {
                this.oauthCancelRequested = true;
                uiThemeManager.hideOAuthLoadingModal();
                uiThemeManager.showNotification('OAuth connection cancelled', 'info');
            });
        }
    }

    /**
     * Setup modal event listeners
     */
    private setupModalListeners(): void {
        // Close buttons
        if (this.domElements.closeComposeBtn) {
            this.domElements.closeComposeBtn.addEventListener('click', () => {
                console.log('Close compose button clicked');
                uiThemeManager.hideComposeModal();
            });
            console.log('Close compose button listener attached');
        } else {
            console.error('Close compose button not found');
        }

        if (this.domElements.closeSettingsBtn) {
            this.domElements.closeSettingsBtn.addEventListener('click', () => {
                console.log('Close settings button clicked');
                uiThemeManager.hideSettingsModal();
            });
            console.log('Close settings button listener attached');
        } else {
            console.error('Close settings button not found');
        }

        // Modal backdrop clicks
        if (this.domElements.composeModal) {
            this.domElements.composeModal.addEventListener('click', (e: Event) => {
                if (e.target === this.domElements.composeModal) {
                    uiThemeManager.hideComposeModal();
                }
            });
        }

        if (this.domElements.settingsModal) {
            this.domElements.settingsModal.addEventListener('click', (e: Event) => {
                if (e.target === this.domElements.settingsModal) {
                    uiThemeManager.hideSettingsModal();
                }
            });
        }
    }

    /**
     * Setup form event listeners
     */
    private setupFormListeners(): void {
        // Compose form
        if (this.domElements.composeForm) {
            this.domElements.composeForm.addEventListener('submit', async (e: Event) => {
                e.preventDefault();
                console.log('Compose form submitted');
                await this.emailComposer.sendEmail();
            });
            console.log('Compose form listener attached');
        } else {
            console.error('Compose form not found');
        }

        // Settings form
        if (this.domElements.settingsForm) {
            this.domElements.settingsForm.addEventListener('submit', (e: Event) => {
                e.preventDefault();
                console.log('Settings form submitted');
                // TODO: Implement settings save functionality
            });
            console.log('Settings form listener attached');
        } else {
            console.error('Settings form not found');
        }

        // Authentication method selection
        this.setupAuthMethodSelection();
    }

    /**
     * Setup authentication method selection
     */
    private setupAuthMethodSelection(): void {
        const authOptions = document.querySelectorAll('.auth-option');
        const imapConfig = document.getElementById('imap-config');

        authOptions.forEach(option => {
            option.addEventListener('click', async () => {
                const method = (option as HTMLElement).dataset.method;
                // Remove selected class from all options
                authOptions.forEach(opt => opt.classList.remove('selected'));
                // Add selected class to clicked option
                option.classList.add('selected');

                // Show/hide appropriate sections
                if (method === 'imap') {
                    if (imapConfig) imapConfig.style.display = 'block';
                } else {
                    if (imapConfig) imapConfig.style.display = 'none';
                }

                // Trigger SSO logic directly for Google/Microsoft
                if (method === 'google') {
                    try {
                        await AuthManager.handleGoogleSSO();
                    } catch (error) {
                        console.error('Error in Google SSO:', error);
                    }
                } else if (method === 'microsoft') {
                    try {
                        const result: SSOResult = await ipcRenderer.invoke('microsoft-sso');
                        if (result.success) {
                            console.log('Microsoft SSO successful! (Token received)');
                        } else {
                            console.error('Microsoft SSO failed:', result.error);
                        }
                    } catch (error) {
                        console.error('Error in Microsoft SSO:', error);
                    }
                }

                console.log('Authentication method selected:', method);
            });
        });

        // Set default selection to Google SSO
        const googleOption = document.querySelector('.auth-option[data-method="google"]');
        if (googleOption) {
            googleOption.classList.add('selected');
            if (imapConfig) imapConfig.style.display = 'none';
        }

        console.log('Authentication method selection setup completed');
    }

    /**
     * Setup message input event listeners
     */
    private setupMessageInputListeners(): void {
        if (this.domElements.messageInput) {
            this.domElements.messageInput.addEventListener('input', () => {
                // Auto-resize textarea
                this.domElements.messageInput!.style.height = 'auto';
                this.domElements.messageInput!.style.height = Math.min(this.domElements.messageInput!.scrollHeight, 120) + 'px';
                
                // Enable/disable send button
                const hasContent = this.domElements.messageInput!.value.trim().length > 0;
                if (this.domElements.sendMessageBtn) {
                    this.domElements.sendMessageBtn.disabled = !hasContent;
                }
            });
            
            this.domElements.messageInput.addEventListener('keydown', async (e: KeyboardEvent) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (this.domElements.messageInput!.value.trim()) {
                        await this.emailComposer.sendEmail();
                    }
                }
            });
            console.log('Message input listeners attached');
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        uiThemeManager.showComposeModal();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.imapEmailManager.loadEmails();
                        break;
                    case ',':
                        e.preventDefault();
                        uiThemeManager.showSettingsModal();
                        break;
                }
            }
            
            // Escape key to close modals
            if (e.key === 'Escape') {
                if (this.domElements.composeModal && this.domElements.composeModal.classList.contains('show')) {
                    uiThemeManager.hideComposeModal();
                } else if (this.domElements.settingsModal && this.domElements.settingsModal.classList.contains('show')) {
                    uiThemeManager.hideSettingsModal();
                }
            }
        });
        
        console.log('Keyboard shortcuts setup completed');
    }

    /**
     * Setup theme selector listeners
     */
    private setupThemeListeners(): void {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                const theme = (option as HTMLElement).dataset.theme;
                if (theme && typeof (window as any).switchTheme === 'function') {
                    (window as any).switchTheme(theme);
                }
                
                // Update active state
                document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
            });
        });
        
        console.log('Theme listeners setup completed');
    }

    /**
     * Setup SSO button listeners
     */
    private setupSSOListeners(): void {
        // Google SSO button (now in the sso-buttons section)
        const googleSSOBtn = document.getElementById('google-sso-btn');
        if (googleSSOBtn) {
            googleSSOBtn.addEventListener('click', async () => {
                console.log('Google SSO button clicked');
                try {
                    await AuthManager.handleGoogleSSO();
                } catch (error) {
                    console.error('Error in Google SSO:', error);
                    // Note: showNotification should be imported from UIThemeManager if needed
                }
            });
        } else {
            console.error('Google SSO button not found');
        }
        
        // Microsoft SSO button (now in the sso-buttons section)
        const microsoftSSOBtn = document.getElementById('microsoft-sso-btn');
        if (microsoftSSOBtn) {
            microsoftSSOBtn.addEventListener('click', async () => {
                console.log('Microsoft SSO button clicked');
                try {
                    const result: SSOResult = await ipcRenderer.invoke('microsoft-sso');
                    if (result.success) {
                        // TODO: Store and use result.token for Microsoft Graph API
                        console.log('Microsoft SSO successful! (Token received)');
                    } else {
                        console.error('Microsoft SSO failed:', result.error);
                    }
                } catch (error) {
                    console.error('Error in Microsoft SSO:', error);
                }
            });
        } else {
            console.error('Microsoft SSO button not found');
        }
        
        console.log('SSO listeners setup completed');
    }

    /**
     * Setup search manager initialization
     */
    private setupSearchManager(): void {
        // TODO: Import and initialize SearchManager properly
        console.log('Search manager initialization completed');
    }

    /**
     * Toggle email metadata visibility
     * @param messageId - Message ID
     */
    toggleEmailMetadata(messageId: string): void {
        console.log('toggleEmailMetadata called with messageId:', messageId);
        const emailItem = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
        if (!emailItem) {
            console.error('Email item not found for messageId:', messageId);
            return;
        }
        
        const metadataContainer = emailItem.querySelector('.gmail-email-metadata') as HTMLElement;
        const metadataToggle = emailItem.querySelector('.gmail-metadata-toggle') as HTMLElement;
        const chevron = emailItem.querySelector('.gmail-metadata-chevron') as HTMLElement;
        const toggleText = emailItem.querySelector('.gmail-metadata-toggle-text') as HTMLElement;
        
        if (!metadataContainer || !metadataToggle || !chevron || !toggleText) {
            console.error('Metadata elements not found for messageId:', messageId);
            return;
        }
        
        const isCurrentlyCollapsed = metadataContainer.classList.contains('collapsed');
        console.log('Metadata currently collapsed:', isCurrentlyCollapsed);
        
        if (isCurrentlyCollapsed) {
            // Expand metadata
            metadataContainer.classList.remove('collapsed');
            chevron.style.transform = 'rotate(90deg)';
            toggleText.textContent = 'Hide details';
            console.log('Metadata expanded');
        } else {
            // Collapse metadata
            metadataContainer.classList.add('collapsed');
            chevron.style.transform = 'rotate(0deg)';
            toggleText.textContent = 'Show details';
            console.log('Metadata collapsed');
        }
    }

    /**
     * Toggle message expansion
     * @param messageElement - Message element
     * @param email - Email object
     */
    toggleMessageExpansion(messageElement: HTMLElement, email: Email): void {
        const messageGroup = messageElement.closest('.message-group') as HTMLElement;
        
        // Check if this is a single message expansion (showing full content)
        if (messageElement.classList.contains('expanded')) {
            // Collapse single message - show preview again
            messageElement.classList.remove('expanded');
            
            // Restore preview content
            let content = email.body || '';
            if (email.bodyHtml) {
                content = content
                    .replace(/<style[^>]*>.*?<\/style>/gis, '')
                    .replace(/<script[^>]*>.*?<\/script>/gis, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .trim()
                    .substring(0, 500);
            } else {
                content = content.substring(0, 500);
            }
            
            const messageContent = messageElement.querySelector('.message-content') as HTMLElement;
            if (messageContent) {
                // TODO: Import and use proper HTML escaping function
                messageContent.textContent = content;
            }
            return;
        }
        
        // Check if this is expanding a single message to show full content
        if (!messageGroup.classList.contains('collapsed')) {
            // Expand single message to show full content
            messageElement.classList.add('expanded');
            
            let fullContent = email.body || '';
            if (email.bodyHtml) {
                // For HTML emails, use the sanitized and styled version
                // TODO: Import and use proper HTML sanitization function
                fullContent = fullContent;
            } else {
                // For plain text emails, convert to HTML
                // TODO: Import and use proper text-to-HTML conversion function
                fullContent = fullContent.replace(/\n/g, '<br>');
            }
            
            const messageContent = messageElement.querySelector('.message-content') as HTMLElement;
            if (messageContent) {
                messageContent.innerHTML = fullContent;
            }
            return;
        }
        
        if (messageGroup.classList.contains('collapsed')) {
            // Expand group
            messageGroup.classList.remove('collapsed');
            messageGroup.classList.add('expanding');
            
            // Show all message bubbles
            const bubbles = messageGroup.querySelectorAll('.message-bubble') as NodeListOf<HTMLElement>;
            bubbles.forEach(bubble => {
                bubble.style.opacity = '1';
                bubble.style.transform = 'scale(1)';
                bubble.style.marginBottom = '2px';
            });
            
            setTimeout(() => {
                messageGroup.classList.remove('expanding');
            }, 300);
        } else {
            // Collapse group
            messageGroup.classList.add('collapsing');
            
            // Hide older messages (keep last 2)
            const bubbles = Array.from(messageGroup.querySelectorAll('.message-bubble')) as HTMLElement[];
            const bubblesToCollapse = bubbles.slice(0, -2);
            
            bubblesToCollapse.forEach(bubble => {
                bubble.style.opacity = '0.7';
                bubble.style.transform = 'scale(0.95)';
                bubble.style.marginBottom = '1px';
            });
            
            setTimeout(() => {
                messageGroup.classList.remove('collapsing');
                messageGroup.classList.add('collapsed');
            }, 300);
        }
    }

    /**
     * Select conversation
     * @param conversationId - Conversation ID
     */
    selectConversation(conversationId: string): void {
        console.log('selectConversation called with ID:', conversationId);
        
        // Get conversations from IMAPEmailManager
        const conversations = this.imapEmailManager.getConversations();
        
        if (!conversations || !conversations[conversationId]) {
            console.error('Conversation not found:', conversationId);
            uiThemeManager.showNotification('Conversation not found', 'error');
            return;
        }
        
        // Remove previous selection
        document.querySelectorAll('.conversation-item.active').forEach(item => {
            item.classList.remove('active');
        });
        
        // Try to find the conversation element by safe ID first
        const conversation = conversations[conversationId] as ConversationData;
        const safeId = conversation.safeId;
        let conversationElement: HTMLElement | null = null;
        
        if (safeId) {
            conversationElement = document.querySelector(`[data-conversation-id="${safeId}"]`) as HTMLElement;
        }
        
        // If not found by safe ID, try the original ID
        if (!conversationElement) {
            const escapedConversationId = CSS.escape(conversationId);
            conversationElement = document.querySelector(`[data-conversation-id="${escapedConversationId}"]`) as HTMLElement;
        }
        
        // If still not found, try fallback method
        if (!conversationElement) {
            const allConversationElements = document.querySelectorAll('.conversation-item') as NodeListOf<HTMLElement>;
            conversationElement = Array.from(allConversationElements).find(el => 
                el.dataset.conversationId === safeId || 
                el.dataset.conversationId === conversationId ||
                (el as any).dataset.originalConversationId === conversationId
            ) || null;
        }
        
        if (conversationElement) {
            conversationElement.classList.add('active');
            console.log('Selected conversation element:', conversationElement);
        } else {
            console.error('Could not find conversation element with ID:', conversationId);
        }
        
        // Display the conversation emails in messages-container
        this.displayConversationEmails(conversationId, conversation);
        console.log('Selected conversation:', conversationId);
        console.log('Conversation data:', conversation);
    }

    /**
     * Handle dynamic email action buttons
     * @param event - Click event
     */
    private handleEmailActionClick(event: Event): void {
        const button = (event.target as HTMLElement).closest('[data-action]') as HTMLElement;
        if (!button) return;
        
        const action = button.dataset.action;
        const messageId = button.dataset.messageId;
        
        if (!action || !messageId) return;
        
        switch (action) {
            case 'reply':
                // TODO: Import and use EmailActions properly
                console.log('Reply action for message:', messageId);
                break;
            case 'reply-all':
                // TODO: Import and use EmailActions properly
                console.log('Reply-all action for message:', messageId);
                break;
            case 'forward':
                // TODO: Import and use EmailActions properly
                console.log('Forward action for message:', messageId);
                break;
            case 'toggle-metadata':
                this.toggleEmailMetadata(messageId);
                break;
            default:
                console.warn('Unknown email action:', action);
        }
    }

    /**
     * Setup dynamic event delegation for email actions
     */
    private setupEmailActionDelegation(): void {
        document.addEventListener('click', (event: Event) => {
            this.handleEmailActionClick(event);
        });
        
        // Listen for modular conversation selection events
        document.addEventListener('selectConversation', (event: Event) => {
            const customEvent = event as CustomEvent;
            this.selectConversation(customEvent.detail.conversationId);
        });
        
        console.log('Email action delegation setup completed');
    }

    /**
     * Refresh event listeners (useful after DOM updates)
     */
    refreshEventListeners(): void {
        console.log('Refreshing event listeners...');
        this.cacheDOMElements();
        // Only setup new listeners for elements that weren't previously available
        this.setupButtonListeners();
        this.setupModalListeners();
        this.setupFormListeners();
    }

    /**
     * Get OAuth cancel status
     * @returns OAuth cancel requested status
     */
    isOAuthCancelRequested(): boolean {
        return this.oauthCancelRequested;
    }

    /**
     * Reset OAuth cancel status
     */
    resetOAuthCancelStatus(): void {
        this.oauthCancelRequested = false;
    }

    /**
     * Check if manager is initialized
     * @returns Initialization status
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Display conversation emails in messages-container
     * @param conversationId - Conversation ID
     * @param conversation - Conversation data
     */
    private displayConversationEmails(conversationId: string, conversation: ConversationData): void {
        console.log('displayConversationEmails called for:', conversationId);
        
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) {
            console.error('Messages container not found');
            return;
        }
        
        if (!conversation || !conversation.emails || conversation.emails.length === 0) {
            console.log('No valid conversation or emails found');
            messagesContainer.innerHTML = `
                <div class="messages-placeholder">
                    <i class="fas fa-comments"></i>
                    <h3>No messages in this conversation</h3>
                    <p>Start a new conversation by typing a message below.</p>
                </div>
            `;
            return;
        }
        
        // Clear messages container
        messagesContainer.innerHTML = '';
        
        // Sort emails by date
        const sortedEmails = [...conversation.emails].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Create simple email list
        const emailsContainer = document.createElement('div');
        emailsContainer.className = 'emails-list';
        
        sortedEmails.forEach((email, index) => {
            const emailElement = this.createSimpleEmailItem(email, index === sortedEmails.length - 1);
            emailsContainer.appendChild(emailElement);
        });
        
        messagesContainer.appendChild(emailsContainer);
        
        // Add marketing tags to emails
        this.addMarketingTagsToEmails(emailsContainer, sortedEmails);
        
        // Scroll to top to show emails from the beginning
        messagesContainer.scrollTop = 0;
        console.log('Conversation emails displayed successfully');
    }
    
    /**
     * Create simple email item element
     * @param email - Email data
     * @param isLatest - Whether this is the latest email
     * @returns HTMLElement for the email
     */
    private createSimpleEmailItem(email: Email, isLatest: boolean = false): HTMLElement {
        const emailElement = document.createElement('div');
        emailElement.className = `email-item ${isLatest ? 'latest' : ''}`;
        emailElement.dataset.messageId = email.messageId || email.id;
        
        // Extract sender info
        const fromEmail = typeof email.from === 'string' ? email.from : email.from?.email || 'Unknown';
        const fromName = this.extractSenderName(fromEmail);
        const date = new Date(email.date);
        const formattedDate = this.formatEmailDate(date);
        
        // Use EmailRenderer to process and render the email content
        let contentHtml = this.emailRenderer.createExpandedContent(email).innerHTML;
        
        emailElement.innerHTML = `
            <div class="email-header">
                <div class="sender-info">
                    <div class="sender-avatar">${fromName.charAt(0).toUpperCase()}</div>
                    <div class="sender-details">
                        <div class="sender-name">${this.escapeHtml(fromName)}</div>
                        <div class="sender-email">${this.escapeHtml(fromEmail)}</div>
                    </div>
                </div>
                <div class="email-meta">
                    <div class="email-date">${formattedDate}</div>
                    ${email.hasAttachments ? '<i class="fas fa-paperclip attachment-icon"></i>' : ''}
                </div>
            </div>
            <div class="email-subject">
                <h3>${this.escapeHtml(email.subject || 'No Subject')}</h3>
            </div>
            <div class="email-content">
                ${contentHtml}
            </div>
            <div class="email-actions">
                <button class="action-btn reply-btn" onclick="this.replyToEmail('${email.messageId || email.id}')">
                    <i class="fas fa-reply"></i> Reply
                </button>
                <button class="action-btn forward-btn" onclick="this.forwardEmail('${email.messageId || email.id}')">
                    <i class="fas fa-share"></i> Forward
                </button>
            </div>
        `;
        
        return emailElement;
    }
    
    /**
     * Reply to email (simplified)
     * @param messageId - Message ID
     */
    replyToEmail(messageId: string): void {
        console.log('Reply to email:', messageId);
        // Show compose modal with pre-filled reply data
        const showComposeModal = (window as any).showComposeModal;
        if (showComposeModal) {
            showComposeModal();
        }
    }
    
    /**
     * Forward email (simplified)
     * @param messageId - Message ID
     */
    forwardEmail(messageId: string): void {
        console.log('Forward email:', messageId);
        // Show compose modal with pre-filled forward data
        const showComposeModal = (window as any).showComposeModal;
        if (showComposeModal) {
            showComposeModal();
        }
    }

    /**
     * Extract sender name from email address
     * @param emailAddress - Email address string
     * @returns Sender name
     */
    private extractSenderName(emailAddress: string): string {
        if (!emailAddress) return 'Unknown';
        
        // Extract name from "Name <email@example.com>" format
        const match = emailAddress.match(/^(.+?)\s*<.*>$/);
        if (match) {
            return match[1].trim().replace(/"/g, '');
        }
        
        // Return email address if no name found
        return emailAddress.split('@')[0];
    }
    
    /**
     * Format email date for display
     * @param date - Date object
     * @returns Formatted date string
     */
    private formatEmailDate(date: Date): string {
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
    
    /**
     * Escape HTML characters
     * @param text - Text to escape
     * @returns Escaped text
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Add marketing tags to emails
     * @param emailsContainer - Emails container element
     * @param emails - Emails array
     */
    private addMarketingTagsToEmails(emailsContainer: HTMLElement, emails: Email[]): void {
        const emailElements = emailsContainer.querySelectorAll('.email-item');
        
        emailElements.forEach((emailElement, index) => {
            const email = emails[index];
            if (!email) return;

            const tag = this.marketingEmailDetector.detectMarketingEmail(email);
            this.marketingEmailDetector.addMarketingTagToElement(emailElement as HTMLElement, tag);
        });
        
        console.log(`Marketing tags processed for ${emailElements.length} emails`);
    }
}

// Export for module systems
export { EventManager, type DOMElements, type SSOResult, type ConversationData };

console.log('EventManager module loaded successfully');

// Initialize conversation list keyboard navigation on startup
initConversationListKeyboardNavigation();

// Add arrow key navigation for conversation items in conversations-list
export function initConversationListKeyboardNavigation() {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) return;

    let selectedIdx = 0;
    let items = Array.from(conversationsList.querySelectorAll('.conversation-item'));

    function updateSelection(newIdx: number) {
        items.forEach((item, idx) => {
            if (idx === newIdx) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
                // Render the selected conversation in the message container
                const conversationId = (item as HTMLElement).dataset.conversationId;
                if (conversationId && typeof window !== 'undefined' && (window as any).eventManager) {
                    (window as any).eventManager.selectConversation(conversationId);
                } else if (item instanceof HTMLElement) {
                    item.click();
                }
            } else {
                item.classList.remove('selected');
            }
        });
        selectedIdx = newIdx;
    }

    // Select the first item by default if available
    if (items.length > 0) {
        updateSelection(0);
    }

    document.addEventListener('keydown', (e) => {
        // Only activate if the conversations list is visible
        if (!conversationsList.offsetParent) {
            return;
        }
        items = Array.from(conversationsList.querySelectorAll('.conversation-item'));
        if (items.length === 0) {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            let nextIdx = selectedIdx + 1;
            if (nextIdx < items.length) {
                updateSelection(nextIdx);
            }
            // Do nothing if at the last item
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            let prevIdx = selectedIdx - 1;
            if (prevIdx >= 0) {
                updateSelection(prevIdx);
            }
            // Do nothing if at the first item
        } else if (e.key === 'Enter' && selectedIdx >= 0) {
            e.preventDefault();
            (items[selectedIdx] as HTMLElement).click();
        }
    });
} 