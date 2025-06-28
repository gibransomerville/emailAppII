// Immediate debug logging to verify file loading
console.log('=== RENDERER.TS STARTING ===');
console.log('Document ready state:', document.readyState);
console.log('DOM loaded:', !!document.getElementById('settings-btn'));

import { uiThemeManager } from './ui-theme-manager.js';
import { IMAPEmailManager } from './imap-email-manager.js';
import { getEmailComposer } from './email-composer.js';
import { EventManager } from './event-manager.js';
import { AuthManager } from './auth-manager.js';
import { getSearchManager } from './search-manager.js';
import { SearchUI } from './ui-components.js';
import { DOMPURIFY_CONFIG, EMAIL_PARSING_CONFIG } from './config.js';
import { SafeHTML } from './safe-html.js';
import { EmailManager } from './email-manager.js';
import { EmailRenderer } from './email-renderer.js';
import { EmailFilterManager } from './email-filter-manager.js';
import { MarketingEmailDetector } from './marketing-email-detector.js';

console.log('=== IMPORTS COMPLETED ===');
console.log('All modules imported successfully');

// Basic DOM availability check
console.log('Settings button exists:', !!document.getElementById('settings-btn'));
console.log('Compose button exists:', !!document.getElementById('compose-btn'));
console.log('DOM elements check completed');

// Create EmailRenderer instance (no longer needs EmailHtmlEngine as parameter)
const emailRenderer = new EmailRenderer();

// Create EmailManager instance with config and parser dependencies
const emailManager = new EmailManager({
    config: EMAIL_PARSING_CONFIG,
    simpleParser: (typeof window !== 'undefined' && (window as any).simpleParser) ? (window as any).simpleParser : undefined
});

console.log('=== EmailManager INSTANCE CREATED ===');
console.log('emailManager instance:', !!emailManager);
console.log('emailManager.standardizeEmailObject function:', typeof emailManager.standardizeEmailObject === 'function');
console.log('emailManager.standardizeEmailObject function name:', emailManager.standardizeEmailObject.name);

// Create instances with proper modular dependencies
const emailComposer = getEmailComposer();

// Create MarketingEmailDetector
console.log('=== CREATING MARKETING EMAIL DETECTOR ===');
const marketingEmailDetector = new MarketingEmailDetector();

// Create IMAPEmailManager first with null event manager (will be set later)
console.log('=== CREATING IMAP EMAIL MANAGER ===');
const imapEmailManager = new IMAPEmailManager(uiThemeManager, null as any, emailManager);

// Now create EventManager with all required dependencies
console.log('=== CREATING EVENT MANAGER ===');
const eventManager = new EventManager(emailComposer, imapEmailManager, emailRenderer, marketingEmailDetector);

// Set the bidirectional reference
console.log('=== SETTING BIDIRECTIONAL REFERENCES ===');
imapEmailManager.setEventManager(eventManager);

console.log('=== INSTANCES CREATED ===');
console.log('EventManager created:', !!eventManager);
console.log('IMAPEmailManager created:', !!imapEmailManager);

// Initialize search manager using singleton pattern (NO duplicate creation)  
getSearchManager(); // Initialize singleton

// Initialize SearchUI
new SearchUI(); // Initialize for global availability

// Initialize global dependencies for EmailHtmlEngine before using it
console.log('=== INITIALIZING GLOBAL DEPENDENCIES ===');

// Make configuration objects available globally
(globalThis as any).DOMPURIFY_CONFIG = DOMPURIFY_CONFIG;
(globalThis as any).EMAIL_PARSING_CONFIG = EMAIL_PARSING_CONFIG;

// Initialize SafeHTML and make it available globally
try {
    SafeHTML.initialize();
    (globalThis as any).SafeHTML = SafeHTML;
    console.log('SafeHTML initialized and made globally available');
} catch (error) {
    console.warn('SafeHTML initialization failed, some features may not work:', error);
    // Create a minimal fallback SafeHTML for basic functionality
    (globalThis as any).SafeHTML = {
        sanitizeEmail: (html: string) => html,
        sanitizeUI: (html: string) => html,
        escapeHtml: (text: string) => text.replace(/[<>&"']/g, (char) => {
            const escapeMap: Record<string, string> = {
                '<': '&lt;',
                '>': '&gt;',
                '&': '&amp;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escapeMap[char];
        })
    };
}

// Main initialization function
async function initializeApp(): Promise<void> {
    try {
        console.log('=== INITIALIZING APP ===');
        console.log('Initializing Email App...');

        // Initialize UI theme manager
        uiThemeManager.initialize();
        console.log('UI Theme Manager initialized');

        // Initialize event manager
        console.log('=== INITIALIZING EVENT MANAGER ===');
        eventManager.initialize();
        console.log('EventManager initialized:', eventManager.isInitialized());

        // Initialize auth manager - it will handle OAuth flow internally
        AuthManager.initialize(uiThemeManager, eventManager, imapEmailManager);
        console.log('Auth Manager initialized');

        // Initialize event listeners - EventManager has SOLE responsibility
        initializeEventListeners();

        // Set up global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            uiThemeManager.showNotification('An unexpected error occurred', 'error');
        });

        // Set up unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            uiThemeManager.showNotification('An unexpected error occurred', 'error');
        });

        console.log('=== APP INITIALIZATION COMPLETED ===');
        console.log('Email App initialized successfully');

    } catch (error) {
        console.error('=== APP INITIALIZATION FAILED ===');
        console.error('Failed to initialize app:', error);
        uiThemeManager.showNotification('Failed to initialize application', 'error');
    }
}

// Initialize when DOM is ready
console.log('=== SETTING UP DOM READY LISTENER ===');
if (document.readyState === 'loading') {
    console.log('DOM still loading, adding listener');
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    console.log('DOM already loaded, initializing immediately');
    initializeApp();
}

// Global search function for compatibility (delegates to singleton)
function performGlobalSearch(query: string): void {
    const manager = getSearchManager();
    manager.performSearch(query);
}

// Export for potential external use
export { initializeApp, performGlobalSearch };

// Initialize event listeners - delegates to EventManager for proper modular approach
function initializeEventListeners(): void {
  // EventManager handles all UI interactions in a modular way
  console.log('Event listeners delegated to EventManager module');
  
  // Ensure EventManager is properly initialized
  if (!eventManager.isInitialized()) {
    console.log('EventManager not initialized, calling initialize...');
    eventManager.initialize();
  }
}

console.log('Renderer module loaded successfully'); 

// DEBUGGING: Add manual email loading function
(window as any).manualLoadEmails = async () => {
    console.log('=== MANUAL EMAIL LOADING ===');
    try {
        const result = await imapEmailManager.loadEmails();
        console.log('Manual email loading result:', result);
    } catch (error) {
        console.error('Manual email loading failed:', error);
    }
};

// DEBUGGING: Add conversation debugging
(window as any).debugConversations = () => {
    console.log('=== CONVERSATION DEBUG ===');
    console.log('IMAPEmailManager emails:', imapEmailManager.getEmails().length);
    console.log('IMAPEmailManager conversations:', Object.keys(imapEmailManager.getConversations()).length);
    console.log('Global emails:', (window as any).emails?.length || 'undefined');
    console.log('Global conversations:', Object.keys((window as any).conversations || {}).length);
    
    // Check conversation list DOM
    const conversationsList = document.getElementById('conversations-list');
    console.log('Conversations list element:', !!conversationsList);
    console.log('Conversations list children count:', conversationsList?.children.length || 'N/A');
};

console.log('Debugging functions added to window: manualLoadEmails(), debugConversations()');

// Add EmailFilterManager to global scope
(window as any).emailFilterManager = new EmailFilterManager(); 