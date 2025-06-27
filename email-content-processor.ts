/**
 * Email Content Processor Module
 * Centralized, pipeline-based email content processing with best practices
 * Handles HTML sanitization, plain text formatting, and URL conversion properly
 */

import type { Email } from './types/email';

/**
 * Content type detection results
 */
interface ContentTypeResult {
    isHtml: boolean;
    confidence: number;
    indicators: string[];
}

/**
 * Processing pipeline configuration
 */
interface ProcessingConfig {
    enableUrlConversion: boolean;
    enableEmailLinking: boolean;
    preserveLineBreaks: boolean;
    sanitizationMode: 'email' | 'ui' | 'strict';
    debugMode: boolean;
}

/**
 * Processed content result
 */
interface ProcessedContent {
    html: string;
    plainText: string;
    contentType: 'html' | 'text';
    processingSteps: string[];
    warnings: string[];
}

/**
 * Email Content Processor - Best Practices Implementation
 */
export const EmailContentProcessor = {
    
    /**
     * Main entry point for processing email content
     * @param email - Email object containing content
     * @param config - Processing configuration
     * @returns Processed content ready for display
     */
    processEmailContent(email: Email, config: Partial<ProcessingConfig> = {}): ProcessedContent {
        const fullConfig: ProcessingConfig = {
            enableUrlConversion: true,
            enableEmailLinking: true,
            preserveLineBreaks: true,
            sanitizationMode: 'email',
            debugMode: false,
            ...config
        };

        const processingSteps: string[] = [];
        const warnings: string[] = [];

        if (fullConfig.debugMode) {
            console.log('EmailContentProcessor: Starting processing for email:', email.messageId);
        }

        // Step 1: Determine the best content source
        const contentSource = this.selectBestContentSource(email);
        processingSteps.push(`Selected content source: ${contentSource.source}`);

        // Step 2: Detect content type
        const contentTypeResult = this.detectContentType(contentSource.content);
        processingSteps.push(`Detected content type: ${contentTypeResult.isHtml ? 'HTML' : 'Plain Text'} (confidence: ${contentTypeResult.confidence})`);

        // Step 3: Process based on content type
        let processedContent: ProcessedContent;

        if (contentTypeResult.isHtml) {
            processedContent = this.processHtmlContent(contentSource.content, fullConfig);
        } else {
            processedContent = this.processPlainTextContent(contentSource.content, fullConfig);
        }

        // Step 4: Merge results
        return {
            ...processedContent,
            processingSteps: [...processingSteps, ...processedContent.processingSteps],
            warnings: [...warnings, ...processedContent.warnings]
        };
    },

    /**
     * Select the best content source from available email fields
     * @param email - Email object
     * @returns Best content source and its origin
     */
    selectBestContentSource(email: Email): { content: string; source: string } {
        // Priority order: html > text > bodyHtml > bodyText > body
        const sources = [
            { content: (email as any).html, source: 'email.html' },
            { content: (email as any).text, source: 'email.text' },
            { content: email.bodyHtml, source: 'email.bodyHtml' },
            { content: email.bodyText, source: 'email.bodyText' },
            { content: email.body, source: 'email.body' }
        ];

        for (const source of sources) {
            if (source.content && typeof source.content === 'string' && source.content.trim()) {
                return { content: source.content.trim(), source: source.source };
            }
        }

        return { content: '[No content available]', source: 'fallback' };
    },

    /**
     * Advanced content type detection using multiple indicators
     * @param content - Content to analyze
     * @returns Content type detection result
     */
    detectContentType(content: string): ContentTypeResult {
        if (!content || typeof content !== 'string') {
            return { isHtml: false, confidence: 0, indicators: ['empty-content'] };
        }

        const indicators: string[] = [];
        let htmlScore = 0;

        // Pre-check for XML/code content that should be treated as plain text
        const xmlCodePatterns = [
            { pattern: /<\?xml[^>]*\?>/i, weight: -20, name: 'xml-declaration' },
            { pattern: /<(config|configuration|settings|data|xml|root|document)[^>]*>/i, weight: -15, name: 'xml-root-elements' },
            { pattern: /<[A-Z][A-Z0-9_]*[^>]*>/g, weight: -10, name: 'uppercase-xml-tags' },
            { pattern: /^\s*<[^>]+>[^<]*<\/[^>]+>\s*$/s, weight: -8, name: 'simple-xml-structure' },
            { pattern: /<[a-z]+:[a-z]+[^>]*>/i, weight: -12, name: 'namespaced-xml' }
        ];

        // Check for XML/code indicators first
        for (const { pattern, weight, name } of xmlCodePatterns) {
            const matches = content.match(pattern);
            if (matches) {
                htmlScore += weight * Math.min(matches.length, 2);
                indicators.push(`${name}:${matches.length}`);
            }
        }

        // HTML tag patterns (weighted by importance) - only for actual HTML elements
        const htmlPatterns = [
            { pattern: /<\/(div|p|span|table|tr|td|ul|ol|li|h[1-6]|strong|em|b|i|u|a|img|section|article|header|footer|nav|main|aside)[^>]*>/i, weight: 10, name: 'html-closing-tags' },
            { pattern: /<(div|p|span|table|tr|td|ul|ol|li|h[1-6])[^>]*>/i, weight: 8, name: 'block-elements' },
            { pattern: /<(strong|em|b|i|u|a|img)[^>]*>/i, weight: 6, name: 'inline-elements' },
            { pattern: /&[a-zA-Z][a-zA-Z0-9]*;/g, weight: 4, name: 'html-entities' },
            { pattern: /<[a-z]+[^>]*\s+style\s*=/i, weight: 6, name: 'styled-elements' },
            { pattern: /<[a-z]+[^>]*\s+class\s*=/i, weight: 4, name: 'classed-elements' },
            { pattern: /<(html|head|body|meta|link|script|style)[^>]*>/i, weight: 12, name: 'document-structure' },
            { pattern: /<!DOCTYPE\s+html/i, weight: 15, name: 'html-doctype' }
        ];

        for (const { pattern, weight, name } of htmlPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                htmlScore += weight * Math.min(matches.length, 3); // Cap at 3 matches per pattern
                indicators.push(`${name}:${matches.length}`);
            }
        }

        // Plain text indicators (negative scoring)
        const textPatterns = [
            { pattern: /^[^<]*<[^>]+>[^<]*$/g, weight: -5, name: 'single-angle-brackets' },
            { pattern: /^\s*[^<>]*\s*$/g, weight: -2, name: 'no-angle-brackets' }
        ];

        for (const { pattern, weight, name } of textPatterns) {
            if (pattern.test(content)) {
                htmlScore += weight;
                indicators.push(name);
            }
        }

        // Additional context checks
        const contextChecks = [
            { pattern: /^[\s\S]*<(div|p|html|body)[\s\S]*<\/(div|p|html|body)>[\s\S]*$/i, weight: 8, name: 'html-document-structure' },
            { pattern: /href\s*=\s*["'][^"']*["']/i, weight: 5, name: 'html-links' },
            { pattern: /src\s*=\s*["'][^"']*["']/i, weight: 5, name: 'html-resources' }
        ];

        for (const { pattern, weight, name } of contextChecks) {
            if (pattern.test(content)) {
                htmlScore += weight;
                indicators.push(name);
            }
        }

        // Calculate confidence (0-1 scale) with adjusted threshold
        const confidence = Math.max(0, Math.min(1, htmlScore / 25));
        const isHtml = confidence > 0.4 && htmlScore > 0; // Higher threshold and must be positive

        return {
            isHtml,
            confidence,
            indicators
        };
    },

    /**
     * Process HTML content with proper sanitization
     * @param content - HTML content
     * @param config - Processing configuration
     * @returns Processed HTML content
     */
    processHtmlContent(content: string, config: ProcessingConfig): ProcessedContent {
        const processingSteps: string[] = [];
        const warnings: string[] = [];

        // Step 1: Clean and normalize HTML
        let html = this.normalizeHtmlContent(content);
        processingSteps.push('Normalized HTML content');

        // Step 2: Sanitize with DOMPurify
        const safeHTML = (globalThis as any).SafeHTML;
        if (safeHTML?.sanitizeEmail) {
            html = safeHTML.sanitizeEmail(html);
            processingSteps.push(`Sanitized with DOMPurify (${config.sanitizationMode} mode)`);
        } else {
            warnings.push('SafeHTML not available, HTML not sanitized');
        }

        // Step 3: Extract plain text version
        const plainText = this.extractPlainTextFromHtml(html);
        processingSteps.push('Extracted plain text version');

        return {
            html,
            plainText,
            contentType: 'html',
            processingSteps,
            warnings
        };
    },

    /**
     * Process plain text content with URL conversion and formatting
     * @param content - Plain text content
     * @param config - Processing configuration
     * @returns Processed content as HTML
     */
    processPlainTextContent(content: string, config: ProcessingConfig): ProcessedContent {
        const processingSteps: string[] = [];
        const warnings: string[] = [];

        let text = content;

        // Step 1: Normalize whitespace and line breaks
        text = this.normalizePlainText(text);
        processingSteps.push('Normalized plain text');

        // Step 2: Check if content contains XML/code that needs special handling
        const hasXmlContent = this.detectXmlContent(text);
        if (hasXmlContent) {
            processingSteps.push('Detected XML/code content');
            
            // Use special XML processing that preserves structure but converts URLs
            text = this.processXmlAndCodeContent(text);
            processingSteps.push('Processed XML/code content with URL conversion');
        } else {
            // Step 2a: Convert URLs BEFORE HTML escaping (this is the key fix!)
            if (config.enableUrlConversion) {
                text = this.convertUrlsToLinks(text);
                processingSteps.push('Converted URLs to links');
            }

            // Step 3: Convert email addresses to mailto links
            if (config.enableEmailLinking) {
                text = this.convertEmailsToLinks(text);
                processingSteps.push('Converted emails to mailto links');
            }

            // Step 4: Escape remaining HTML characters (after URL conversion)
            text = this.escapeHtmlEntities(text);
            processingSteps.push('Escaped HTML entities');
        }

        // Step 5: Convert line breaks to HTML
        if (config.preserveLineBreaks) {
            text = this.convertLineBreaksToHtml(text);
            processingSteps.push('Converted line breaks to HTML');
        }

        // Step 6: Wrap in proper HTML structure
        const html = `<div class="email-content-wrapper">${text}</div>`;
        
        // Step 7: Extract plain text (original content, cleaned)
        const plainText = this.cleanPlainText(content);

        return {
            html,
            plainText,
            contentType: 'text',
            processingSteps,
            warnings
        };
    },

    /**
     * Convert URLs to clickable links (handles angle brackets correctly)
     * This runs BEFORE HTML escaping to preserve URL structure
     * @param text - Plain text with URLs
     * @returns Text with URLs converted to HTML links
     */
    convertUrlsToLinks(text: string): string {
        // Pattern 1: URLs wrapped in angle brackets <https://example.com>
        text = text.replace(
            /<(https?:\/\/[^\s<>]+)>/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        // Pattern 2: Standalone URLs (not in angle brackets, not already in links)
        text = text.replace(
            /(?<!<a [^>]*href=")(https?:\/\/[^\s<>"'()]+)(?![^<]*<\/a>)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        // Pattern 3: URLs in XML/code contexts - be more conservative
        // Only convert if it's clearly a URL, not part of XML structure
        text = text.replace(
            /(?<!<[^>]*)(https?:\/\/[^\s<>"'()]+)(?![^<]*>)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        return text;
    },

    /**
     * Enhanced method to handle XML/code content specially
     * @param text - Text that may contain XML/code
     * @returns Text with XML properly escaped but URLs still converted
     */
    processXmlAndCodeContent(text: string): string {
        // Temporarily replace URLs to protect them during XML processing
        const urlPlaceholders: { placeholder: string; url: string }[] = [];
        let placeholderIndex = 0;

        // Extract and protect URLs first
        text = text.replace(/https?:\/\/[^\s<>"'()]+/gi, (url) => {
            const placeholder = `__URL_PLACEHOLDER_${placeholderIndex++}__`;
            urlPlaceholders.push({ placeholder, url });
            return placeholder;
        });

        // Now escape XML/HTML entities
        text = this.escapeHtmlEntities(text);

        // Restore URLs as clickable links
        urlPlaceholders.forEach(({ placeholder, url }) => {
            const link = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            text = text.replace(placeholder, link);
        });

        return text;
    },

    /**
     * Convert email addresses to mailto links
     * @param text - Text with email addresses
     * @returns Text with emails converted to mailto links
     */
    convertEmailsToLinks(text: string): string {
        return text.replace(
            /(?<!<a [^>]*href="[^"]*)([\w._%+-]+@[\w.-]+\.[A-Za-z]{2,})(?![^<]*<\/a>)/gi,
            '<a href="mailto:$1">$1</a>'
        );
    },

    /**
     * Escape HTML entities for text that may contain HTML-like content
     * @param text - Text to escape
     * @returns Escaped text
     */
    escapeHtmlEntities(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Convert line breaks to HTML
     * @param text - Text with line breaks
     * @returns Text with HTML line breaks
     */
    convertLineBreaksToHtml(text: string): string {
        // Convert double line breaks to paragraph breaks
        let html = text.replace(/\n\s*\n/g, '</p><p>');
        
        // Convert single line breaks to <br>
        html = html.replace(/\n/g, '<br>');
        
        // Wrap in paragraphs if we have paragraph breaks
        if (html.includes('</p><p>')) {
            html = '<p>' + html + '</p>';
            // Clean up empty paragraphs
            html = html.replace(/<p><\/p>/g, '');
            html = html.replace(/<p>\s*<br>\s*<\/p>/g, '<br>');
        }

        return html;
    },

    /**
     * Normalize HTML content
     * @param html - Raw HTML content
     * @returns Normalized HTML
     */
    normalizeHtmlContent(html: string): string {
        return html
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim();
    },

    /**
     * Normalize plain text content
     * @param text - Raw plain text
     * @returns Normalized text
     */
    normalizePlainText(text: string): string {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, '    ') // Convert tabs to spaces
            .trim();
    },

    /**
     * Extract plain text from HTML content
     * @param html - HTML content
     * @returns Plain text
     */
    extractPlainTextFromHtml(html: string): string {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    },

    /**
     * Clean plain text for consistent processing
     * @param text - Raw plain text
     * @returns Cleaned plain text
     */
    cleanPlainText(text: string): string {
        return text
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Generate preview text from processed content
     * @param processedContent - Processed content
     * @param maxLength - Maximum length
     * @returns Preview text
     */
    generatePreview(processedContent: ProcessedContent, maxLength: number = 80): string {
        const text = processedContent.plainText || this.extractPlainTextFromHtml(processedContent.html);
        const firstLine = text.split('\n')[0] || 'No content available';
        return firstLine.length > maxLength ? 
            firstLine.substring(0, maxLength) + '...' : firstLine;
    },

    /**
     * Validate processing dependencies
     * @returns Validation result
     */
    validateDependencies(): { isValid: boolean; missing: string[] } {
        const missing: string[] = [];

        if (typeof (globalThis as any).SafeHTML === 'undefined') {
            missing.push('SafeHTML');
        }

        if (typeof document === 'undefined') {
            missing.push('DOM document');
        }

        return {
            isValid: missing.length === 0,
            missing
        };
    },

    /**
     * Detect if content contains XML/code that needs special handling
     * @param content - Content to check
     * @returns True if XML/code content detected
     */
    detectXmlContent(content: string): boolean {
        const xmlIndicators = [
            /<\?xml[^>]*\?>/i,
            /<(config|configuration|settings|data|xml|root|document|properties)[^>]*>/i,
            /<[A-Z][A-Z0-9_]*[^>]*>/,
            /<[a-z]+:[a-z]+[^>]*>/i,
            /^\s*<[^>]+>[^<]*<\/[^>]+>\s*$/s
        ];

        return xmlIndicators.some(pattern => pattern.test(content));
    }
};

// Legacy wrapper functions for backward compatibility
export function processEmailContent(email: Email, config?: Partial<ProcessingConfig>): ProcessedContent {
    return EmailContentProcessor.processEmailContent(email, config);
}

export function convertUrlsToLinks(text: string): string {
    return EmailContentProcessor.convertUrlsToLinks(text);
}

export function detectContentType(content: string): ContentTypeResult {
    return EmailContentProcessor.detectContentType(content);
}

export function processXmlAndCodeContent(text: string): string {
    return EmailContentProcessor.processXmlAndCodeContent(text);
}

export function detectXmlContent(content: string): boolean {
    return EmailContentProcessor.detectXmlContent(content);
}

// Browser environment exports
if (typeof window !== 'undefined') {
    (window as any).EmailContentProcessor = EmailContentProcessor;
    (window as any).processEmailContent = processEmailContent;
    (window as any).convertUrlsToLinks = convertUrlsToLinks;
    (window as any).detectContentType = detectContentType;
    (window as any).processXmlAndCodeContent = processXmlAndCodeContent;
    (window as any).detectXmlContent = detectXmlContent;
}

// Export for module systems
export default EmailContentProcessor; 