/**
 * Email Application Configuration Module
 * Contains all configuration objects and constants used throughout the application
 * This is the compiled JavaScript version of config.ts
 */

// Configuration for email parsing
const EMAIL_PARSING_CONFIG = {
    useMailparser: true, // Enable/disable mailparser usage
    fallbackToManual: true, // Fallback to manual parsing if mailparser fails
    debugParsing: true, // Enable detailed parsing logs
    
    // Content processing
    maxContentLength: 1024 * 1024, // 1MB max content length
    stripHtmlForPreview: true,
    preserveOriginalHtml: true,
    
    // Attachment handling
    maxAttachmentSize: 25 * 1024 * 1024, // 25MB max attachment size
    allowedAttachmentTypes: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'text/plain', 'text/html', 'text/css', 'text/javascript',
        'application/pdf', 'application/msword', 'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    inlineImageHandling: 'embed',
    
    // Threading
    enableThreading: true,
    threadingAlgorithm: 'hybrid',
    maxThreadDepth: 10,
    
    // Performance
    batchSize: 50,
    concurrentParsing: true,
    cacheResults: true
};

// DOMPurify configuration for safe HTML rendering
const DOMPURIFY_CONFIG = {
    // Base configuration
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'hr', 'small', 'sub', 'sup', 'mark', 'del', 'ins', 'center', 'font'
    ],
    ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height', 'style', 'class', 'id', 'target',
        'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'bgcolor', 'color', 'face', 'size'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    
    // Security settings
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    FORBID_CONTENTS: ['script'],
    
    // Processing options
    KEEP_CONTENT: true,
    IN_PLACE: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    SANITIZE_DOM: true,
    
    // Email content configuration - more permissive for email HTML
    email: {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
            'hr', 'small', 'sub', 'sup', 'mark', 'del', 'ins', 'center', 'font', 'style'
        ],
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'width', 'height', 'style', 'class', 'id', 'target',
            'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'bgcolor', 'color', 'face', 'size', 'loading'
        ],
        FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    },
    
    // UI content configuration - more restrictive for app UI
    ui: {
        ALLOWED_TAGS: ['span', 'div', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'small', 'code'],
        ALLOWED_ATTR: ['class', 'id', 'style'],
        FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'a', 'img'],
        FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'href', 'src']
    },
    
    // Strict configuration for user input
    strict: {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u'],
        ALLOWED_ATTR: [],
        FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'a', 'img', 'style'],
        FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'href', 'src', 'style']
    }
};

// OAuth Configuration for Google and Microsoft SSO
const OAUTH_CONFIG = {
    google: {
        clientId: '1049056328786-r9n3kvsk9jutk92tgbbgmufq3u392mlq.apps.googleusercontent.com',
        clientSecret: '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',
        scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ],
        redirectUri: 'http://localhost:3001/callback',
        callbackPort: 3001,
        accessType: 'offline',
        prompt: 'consent'
    },
    microsoft: {
        clientId: 'MISSING', // Replace with your Microsoft OAuth Client ID
        clientSecret: 'MISSING', // Replace with your Microsoft OAuth Client Secret
        scopes: [
            'https://graph.microsoft.com/Mail.Read',
            'https://graph.microsoft.com/Mail.Send',
            'https://graph.microsoft.com/User.Read'
        ],
        redirectUri: 'http://localhost:3000/callback',
        callbackPort: 3000,
        accessType: 'offline'
    }
};

// Application-wide constants
const APP_CONFIG = {
    // Application metadata
    name: 'Electron Email App',
    version: '1.0.0',
    description: 'A modern email application built with Electron and TypeScript',
    
    // Window settings
    window: {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        maximizable: true,
        minimizable: true
    },
    
    // Development settings
    isDevelopment: process.env.NODE_ENV === 'development',
    enableDevTools: process.env.NODE_ENV === 'development',
    enableLogging: true,
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    
    // Feature flags
    features: {
        enableSearch: true,
        enableThreading: true,
        enableAttachments: true,
        enableOAuth: true,
        enableDrafts: true,
        enableNotifications: true
    },
    
    // Performance settings
    performance: {
        emailBatchSize: 50,
        searchDebounceMs: 300,
        autoSaveIntervalMs: 30000, // 30 seconds
        cacheSize: 1000
    },
    
    // UI settings
    ui: {
        defaultTheme: 'light',
        animationsEnabled: true,
        compactMode: false,
        showPreviewPane: true
    }
};

// Legacy constants for backward compatibility
const LEGACY_CONSTANTS = {
    // UI Constants
    THEME: {
        DEFAULT: 'light',
        STORAGE_KEY: 'email-app-theme'
    },
    
    // Email Constants
    EMAIL: {
        MAX_SUBJECT_LENGTH: 100,
        MAX_PREVIEW_LENGTH: 80,
        DEFAULT_FOLDER: 'inbox',
        FOLDERS: ['inbox', 'sent', 'drafts', 'trash']
    },
    
    // Search Constants
    SEARCH: {
        MIN_QUERY_LENGTH: 2,
        MAX_RESULTS: 100,
        DEBOUNCE_MS: 300
    },
    
    // Notification Constants
    NOTIFICATION: {
        DURATION: 3000,
        POSITION: 'top-right'
    }
};

// Export all configurations for global access
if (typeof window !== 'undefined') {
    // Browser environment - make available globally
    window.EMAIL_PARSING_CONFIG = EMAIL_PARSING_CONFIG;
    window.DOMPURIFY_CONFIG = DOMPURIFY_CONFIG;
    window.OAUTH_CONFIG = OAUTH_CONFIG;
    window.APP_CONFIG = APP_CONFIG;
    window.LEGACY_CONSTANTS = LEGACY_CONSTANTS;
}

// Node.js environment - export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EMAIL_PARSING_CONFIG,
        DOMPURIFY_CONFIG,
        OAUTH_CONFIG,
        APP_CONFIG,
        LEGACY_CONSTANTS
    };
} 