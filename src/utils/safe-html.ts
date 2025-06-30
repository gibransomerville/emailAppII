/**
 * Safe HTML Utilities Module
 * Provides HTML sanitization and security utilities for the email application
 * Dependencies: DOMPurify (loaded globally), DOMPURIFY_CONFIG, EMAIL_PARSING_CONFIG (from config.ts)
 */

import type { 
  SanitizationMode, 
  SafeHTMLOptions, 
  SafeHTMLTemplateData, 
  SafeHTMLValidationResult 
} from '../../types/ui';
import type { DOMPurifyConfig, EmailParsingConfig } from '../../types/config';

// Dependencies are loaded globally via script tags and config modules:
// - DOMPurify: loaded via CDN in index.html
// - DOMPURIFY_CONFIG: loaded via config.ts
// - EMAIL_PARSING_CONFIG: loaded via config.ts

declare global {
  const DOMPURIFY_CONFIG: DOMPurifyConfig;
  const EMAIL_PARSING_CONFIG: EmailParsingConfig;
  const DOMPurify: {
    sanitize(dirty: string, config?: any): string;
    addHook(hook: string, callback: (node: Node) => void): void;
    removeHooks(hook: string): void;
  };
}

/**
 * Safe HTML utilities class
 */
export class SafeHTML {
    /**
     * Sanitize HTML content for email display
     */
    static sanitizeEmail(html: string, options: SafeHTMLOptions = {}): string {
        if (!html || typeof html !== 'string') {
            return '';
        }
        
        const config = { ...DOMPURIFY_CONFIG.email, ...options };
        
        try {
            // Add custom hook to preserve style attributes exactly as they are
            DOMPurify.addHook('beforeSanitizeAttributes', (node) => {
                // Store original style attributes to prevent corruption
                const element = node as HTMLElement;
                if (element.hasAttribute && element.hasAttribute('style')) {
                    (element as any)._originalStyle = element.getAttribute('style');
                }
            });
            
            DOMPurify.addHook('afterSanitizeAttributes', (node) => {
                // Restore original style attributes if they were corrupted
                const element = node as HTMLElement;
                if ((element as any)._originalStyle) {
                    element.setAttribute('style', (element as any)._originalStyle);
                    delete (element as any)._originalStyle;
                }
            });
            
            const sanitized = DOMPurify.sanitize(html, config);
            
            // Remove the hooks after sanitization
            DOMPurify.removeHooks('beforeSanitizeAttributes');
            DOMPurify.removeHooks('afterSanitizeAttributes');
            
            if (EMAIL_PARSING_CONFIG.debugParsing) {
                console.log('Email HTML sanitized:', {
                    originalLength: html.length,
                    sanitizedLength: sanitized.length,
                    removedContent: html.length - sanitized.length
                });
            }
            
            return sanitized;
        } catch (error) {
            console.error('Error sanitizing email HTML:', error);
            return this.escapeHtml(html);
        }
    }
    
    /**
     * Sanitize HTML content for UI display
     */
    static sanitizeUI(html: string, options: SafeHTMLOptions = {}): string {
        if (!html || typeof html !== 'string') {
            return '';
        }
        
        const config = { ...DOMPURIFY_CONFIG.ui, ...options };
        
        try {
            return DOMPurify.sanitize(html, config);
        } catch (error) {
            console.error('Error sanitizing UI HTML:', error);
            return this.escapeHtml(html);
        }
    }
    
    /**
     * Strictly sanitize HTML content (very restrictive)
     */
    static sanitizeStrict(html: string, options: SafeHTMLOptions = {}): string {
        if (!html || typeof html !== 'string') {
            return '';
        }
        
        const config = { ...DOMPURIFY_CONFIG.strict, ...options };
        
        try {
            return DOMPurify.sanitize(html, config);
        } catch (error) {
            console.error('Error sanitizing HTML strictly:', error);
            return this.escapeHtml(html);
        }
    }
    
    /**
     * Safely set innerHTML with sanitization
     */
    static setInnerHTML(element: HTMLElement, html: string, mode: SanitizationMode = 'ui'): void {
        if (!element || !html) {
            if (element) element.innerHTML = '';
            return;
        }
        
        let sanitizedHTML: string;
        switch (mode) {
            case 'email':
                sanitizedHTML = this.sanitizeEmail(html);
                break;
            case 'strict':
                sanitizedHTML = this.sanitizeStrict(html);
                break;
            case 'ui':
            default:
                sanitizedHTML = this.sanitizeUI(html);
                break;
        }
        
        element.innerHTML = sanitizedHTML;
    }
    
    /**
     * Escape HTML entities (fallback method)
     */
    static escapeHtml(text: string): string {
        if (!text || typeof text !== 'string') {
            return '';
        }
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Create a safe HTML template
     */
    static template(template: string, data: SafeHTMLTemplateData = {}, mode: SanitizationMode = 'ui'): string {
        let html = template;
        
        // Replace placeholders with escaped data
        Object.entries(data).forEach(([key, value]) => {
            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            const escapedValue = this.escapeHtml(String(value));
            html = html.replace(placeholder, escapedValue);
        });
        
        // Sanitize the final HTML
        switch (mode) {
            case 'email':
                return this.sanitizeEmail(html);
            case 'strict':
                return this.sanitizeStrict(html);
            case 'ui':
            default:
                return this.sanitizeUI(html);
        }
    }

    /**
     * Validate that required dependencies are available
     */
    static validateDependencies(): SafeHTMLValidationResult {
        const missing: string[] = [];
        const errors: string[] = [];
        
        if (typeof DOMPurify === 'undefined') {
            missing.push('DOMPurify');
            errors.push('DOMPurify library is not loaded. Please include it via CDN or bundle.');
        }
        
        if (typeof DOMPURIFY_CONFIG === 'undefined') {
            missing.push('DOMPURIFY_CONFIG');
            errors.push('DOMPURIFY_CONFIG is not available. Please ensure config.ts is loaded.');
        }
        
        if (typeof EMAIL_PARSING_CONFIG === 'undefined') {
            missing.push('EMAIL_PARSING_CONFIG');
            errors.push('EMAIL_PARSING_CONFIG is not available. Please ensure config.ts is loaded.');
        }
        
        const isValid = missing.length === 0;
        
        if (!isValid) {
            console.error('SafeHTML module missing dependencies:', missing);
        }
        
        return {
            isValid,
            missingDependencies: missing,
            errors
        };
    }

    /**
     * Initialize the SafeHTML module
     */
    static initialize(): boolean {
        const validation = this.validateDependencies();
        
        if (!validation.isValid) {
            const errorMsg = `SafeHTML module cannot initialize due to missing dependencies: ${validation.missingDependencies.join(', ')}`;
            throw new Error(errorMsg);
        }
        
        console.log('SafeHTML module initialized successfully');
        return true;
    }
}

// Legacy object-style export for backward compatibility
export const SafeHTMLLegacy = {
    sanitizeEmail: SafeHTML.sanitizeEmail.bind(SafeHTML),
    sanitizeUI: SafeHTML.sanitizeUI.bind(SafeHTML),
    sanitizeStrict: SafeHTML.sanitizeStrict.bind(SafeHTML),
    setInnerHTML: SafeHTML.setInnerHTML.bind(SafeHTML),
    escapeHtml: SafeHTML.escapeHtml.bind(SafeHTML),
    template: SafeHTML.template.bind(SafeHTML),
    validateDependencies: SafeHTML.validateDependencies.bind(SafeHTML),
    initialize: SafeHTML.initialize.bind(SafeHTML)
};

// Export for module systems (Node.js compatibility)
export default SafeHTML;

// Make SafeHTML available globally for browser environment
if (typeof window !== 'undefined') {
    (window as any).SafeHTML = SafeHTMLLegacy;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try {
                SafeHTML.initialize();
            } catch (error) {
                console.error('Failed to initialize SafeHTML module:', error);
            }
        });
    } else {
        // DOM is already ready
        try {
            SafeHTML.initialize();
        } catch (error) {
            console.error('Failed to initialize SafeHTML module:', error);
        }
    }
} 