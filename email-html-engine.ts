/**
 * Email HTML Engine - Specialized HTML parsing and rendering for email content
 * Focuses on tables, inline styles, and email-specific HTML patterns
 * Dependencies: SafeHTML, EmailContentProcessor, DOMPURIFY_CONFIG
 */

import { Email } from './types/email.js';

// Email HTML parsing interfaces
interface EmailHtmlParseResult {
    content: string;
    structure: EmailHtmlStructure;
    warnings: string[];
    processingSteps: string[];
}

interface EmailHtmlStructure {
    hasTablesLayout: boolean;
    hasInlineImages: boolean;
    hasComplexStyling: boolean;
    tableCount: number;
    inlineStyleElements: number;
    detectedEmailClient: 'gmail' | 'outlook' | 'apple-mail' | 'generic';
    layoutType: 'table-based' | 'div-based' | 'mixed' | 'simple';
}

interface EmailHtmlRenderOptions {
    maxWidth?: string;
    optimizeForDisplay: boolean;
    preserveOriginalLayout: boolean;
    enhanceReadability: boolean;
    mobileOptimization: boolean;
    sanitizationLevel: 'strict' | 'standard' | 'permissive';
    // Security options for images
    allowExternalImages?: boolean;
    allowNonHttpsImages?: boolean;
    blockTrackingPixels?: boolean;
    showImageWarnings?: boolean;
}

class EmailHtmlEngine {
    constructor() {
        // Remove private sanitizer and config properties
    }

    /**
     * Main entry point for processing email HTML content
     * @param email - Email object containing HTML content
     * @param options - Rendering options
     * @returns Processed and optimized HTML
     */
    processEmailHtml(email: Email, options: Partial<EmailHtmlRenderOptions> = {}): EmailHtmlParseResult {
        console.log('🎯 EmailHtmlEngine.processEmailHtml called for email:', {
            messageId: email.messageId || email.id,
            subject: email.subject?.substring(0, 50) + '...' || '(No Subject)',
            hasBodyHtml: !!email.bodyHtml,
            hasBodyText: !!email.bodyText,
            hasBody: !!email.body,
            hasHtmlProperty: !!(email as any).html,
            bodyHtmlLength: email.bodyHtml?.length || 0,
            bodyTextLength: email.bodyText?.length || 0,
            bodyLength: email.body?.length || 0
        });
        
        const fullOptions: EmailHtmlRenderOptions = {
            maxWidth: '100%',
            optimizeForDisplay: true,
            preserveOriginalLayout: true,
            enhanceReadability: true,
            mobileOptimization: true,
            sanitizationLevel: 'standard',
            ...options
        };

        const processingSteps: string[] = [];
        const warnings: string[] = [];

        // Step 1: Extract HTML content
        const htmlContent = this.extractHtmlContent(email);
        console.log('[DEBUG] processEmailHtml input:', htmlContent.substring(0, 500));
        processingSteps.push(`Extracted HTML content (${htmlContent.length} chars)`);

        if (!htmlContent || htmlContent.trim() === '') {
            console.log('⚠️ No HTML content found for email:', email.messageId || email.id);
            return {
                content: '<div class="email-no-content">No HTML content available</div>',
                structure: this.createEmptyStructure(),
                warnings: ['No HTML content found'],
                processingSteps
            };
        }

        // Step 2: EARLY TABLE PROCESSING - Process tables before other modifications
        let processedHtml = htmlContent;
        const hasTables = this.containsTableHtml(htmlContent);
        if (hasTables) {
            processedHtml = this.optimizeTableLayout(processedHtml, this.createEmptyStructure());
            processingSteps.push('Early table layout optimization applied');
        }

        // Step 3: Analyze HTML structure (after table processing)
        const structure = this.analyzeHtmlStructure(processedHtml);
        processingSteps.push(`Analyzed structure: ${structure.layoutType} layout, ${structure.tableCount} tables`);

        // Step 4: Pre-process HTML for email-specific patterns
        processedHtml = this.preprocessEmailHtml(processedHtml, structure);
        processingSteps.push('Pre-processed email HTML patterns');

        // Step 5: Process inline styles
        if (structure.hasComplexStyling) {
            processedHtml = this.processInlineStyles(processedHtml, fullOptions);
            processingSteps.push('Processed inline styles');
        }

        // Step 6: Handle images and media
        if (structure.hasInlineImages) {
            const imageResult = this.processEmailImages(processedHtml, fullOptions, email);
            processedHtml = imageResult.html;
            warnings.push(...imageResult.warnings);
            processingSteps.push('Processed email images');
        }

        // Step 7: Apply email-specific optimizations
        processedHtml = this.applyEmailOptimizations(processedHtml, structure, fullOptions);
        processingSteps.push('Applied email display optimizations');

        // Step 8: Final sanitization with email-specific rules
        processedHtml = this.sanitizeEmailHtml(processedHtml, fullOptions.sanitizationLevel);
        processingSteps.push('Applied final HTML sanitization');

        // Step 9: Wrap in email container with proper styling
        const finalHtml = this.wrapInEmailContainer(processedHtml, structure, fullOptions);
        processingSteps.push('Wrapped in email display container');

        console.log('✅ Email processing complete:', {
            messageId: email.messageId || email.id,
            finalHtmlLength: finalHtml.length,
            processingSteps,
            warnings
        });

        return {
            content: finalHtml,
            structure,
            warnings,
            processingSteps
        };
    }

    /**
     * Extract HTML content from email object with enhanced format detection
     * @param email - Email object
     * @returns HTML content string
     */
    extractHtmlContent(email: Email): string {
        console.log('📧 EmailHtmlEngine.extractHtmlContent called for email:', email.messageId || email.id);
        
        // Priority: bodyHtml > html property > body (if contains HTML) > bodyText (convert to HTML)
        const sources = [
            { name: 'bodyHtml', content: email.bodyHtml },
            { name: 'html property', content: (email as any).html },
            { name: 'body (if HTML)', content: email.body && this.looksLikeHtml(email.body) ? email.body : null },
            { name: 'bodyText', content: email.bodyText ? this.convertTextToHtml(email.bodyText) : null }
        ];

        console.log('📋 Available content sources:', sources.map(s => ({ 
            name: s.name, 
            hasContent: !!s.content, 
            length: s.content?.length || 0,
            preview: s.content?.substring(0, 100) || 'N/A'
        })));

        for (const source of sources) {
            if (source.content && typeof source.content === 'string' && source.content.trim()) {
                const content = source.content.trim();
                console.log(`🎯 Using content source: ${source.name} (${content.length} chars)`);
                
                const format = this.detectEmailFormat(content);
                console.log(`🔄 Processing format: ${format}`);
                
                switch (format) {
                    case 'complete-html':
                        const result1 = this.extractAndProcessFullHtmlDocument(content);
                        console.log('📄 Complete HTML processed, result length:', result1.length);
                        return result1;
                    case 'pre-processed-text':
                        const result2 = this.processPreProcessedText(content);
                        console.log('🔧 Pre-processed text processed, result length:', result2.length);
                        return result2;
                    case 'html-fragment':
                        console.log('🧩 HTML fragment used as-is');
                        return content;
                    case 'plain-text':
                        const result3 = this.convertTextToHtml(content);
                        console.log('📝 Plain text converted to HTML, result length:', result3.length);
                        return result3;
                    default:
                        console.log('⚠️ Unknown format, using content as-is');
                        return content;
                }
            }
        }

        console.log('❌ No content found in any source');
        return '';
    }

    /**
     * Detect email content format for proper processing
     * @param content - Email content to analyze
     * @returns Email format type
     */
    detectEmailFormat(content: string): 'complete-html' | 'pre-processed-text' | 'html-fragment' | 'plain-text' {
        console.log('🔍 EmailHtmlEngine.detectEmailFormat called with content preview:', content.substring(0, 200));
        
        // 1. Complete HTML Document
        if (this.isCompleteHtmlDocument(content)) {
            console.log('✅ Detected format: complete-html');
            return 'complete-html';
        }
        
        // 2. Pre-processed Text (URLs in parentheses, text-based formatting)
        const isPreProcessed = this.isPreProcessedText(content);
        if (isPreProcessed) {
            console.log('✅ Detected format: pre-processed-text');
            return 'pre-processed-text';
        }
        
        // 3. HTML Fragment
        if (this.looksLikeHtml(content)) {
            console.log('✅ Detected format: html-fragment');
            return 'html-fragment';
        }
        
        // 4. Plain Text
        console.log('✅ Detected format: plain-text');
        return 'plain-text';
    }

    /**
     * Check if content is a complete HTML document
     * @param content - HTML content to check
     * @returns True if it's a complete HTML document
     */
    isCompleteHtmlDocument(content: string): boolean {
        const hasDoctype = /<!DOCTYPE\s+html/i.test(content);
        const hasHtmlTag = /<html[^>]*>/i.test(content);
        const hasHeadTag = /<head[^>]*>/i.test(content);
        const hasBodyTag = /<body[^>]*>/i.test(content);
        
        return hasDoctype || (hasHtmlTag && hasHeadTag && hasBodyTag);
    }

    /**
     * Check if content is pre-processed text from email systems
     * @param content - Content to check
     * @returns True if it's pre-processed text
     */
    isPreProcessedText(content: string): boolean {
        // Early exit if it's clearly HTML
        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(content);
        if (hasHtmlTags) return false;
        
        // Enhanced pattern-agnostic detection system
        const preProcessedIndicators = [
            // URL patterns in various bracket formats
            {
                pattern: /\(\s*https?:\/\/[^\s)]+\s*\)/i,
                weight: 3,
                description: 'URLs in parentheses'
            },
            {
                pattern: /\[\s*https?:\/\/[^\s\]]+\s*\]/i,
                weight: 3,
                description: 'URLs in square brackets'
            },
            {
                pattern: /<\s*https?:\/\/[^\s>]+\s*>/i,
                weight: 3,
                description: 'URLs in angle brackets'
            },
            
            // Unicode and special character patterns (common in email preprocessing)
            {
                pattern: /[͏­]{3,}/,
                weight: 2,
                description: 'Unicode invisible spacers or soft hyphens'
            },
            {
                pattern: /&zwnj;/i,
                weight: 2,
                description: 'Zero-width non-joiner entities'
            },
            {
                pattern: /&shy;/i,
                weight: 1,
                description: 'Soft hyphen entities'
            },
            
            // Text-based dividers and formatting
            {
                pattern: /\*{10,}|\={10,}|\-{10,}|_{10,}/,
                weight: 2,
                description: 'Text-based dividers'
            },
            {
                pattern: /\n\s*\n\s*\n/,
                weight: 1,
                description: 'Multiple consecutive line breaks'
            },
            
            // Email-specific content patterns
            {
                pattern: /unsubscribe\s*[:\-]?\s*https?:\/\/[^\s<>"']+/i,
                weight: 2,
                description: 'Unsubscribe URLs'
            },
            {
                pattern: /view\s+in\s+browser\s*[:\-]?\s*https?:\/\/[^\s<>"']+/i,
                weight: 2,
                description: 'View in browser links'
            },
            {
                pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?!\s*<\/a>)/,
                weight: 1,
                description: 'Plain email addresses (not already linked)'
            },
            
            // Content structure patterns
            {
                pattern: /^[^<]*?\n[^<]*?\n[^<]*?$/s,
                weight: 1,
                description: 'Multi-line plain text structure'
            },
            {
                pattern: /\b(?:click here|read more|learn more|get started|sign up|download|subscribe)\s*[:\-]?\s*https?:\/\/[^\s<>"']+/i,
                weight: 2,
                description: 'Call-to-action URLs'
            }
        ];
        
        // Calculate detection score based on pattern matches
        let detectionScore = 0;
        let matchedPatterns: string[] = [];
        
        for (const indicator of preProcessedIndicators) {
            if (indicator.pattern.test(content)) {
                detectionScore += indicator.weight;
                matchedPatterns.push(indicator.description);
            }
        }
        
        // Enhanced thresholds based on content analysis
        const contentLength = content.length;
        const urlCount = (content.match(/https?:\/\/[^\s<>"']+/gi) || []).length;
        
        // Dynamic threshold based on content characteristics
        let requiredScore = 3; // Base threshold
        
        // Adjust threshold based on content properties
        if (contentLength > 2000) requiredScore = 4; // Longer content needs more evidence
        if (urlCount >= 3) requiredScore = 2; // Multiple URLs lower threshold
        if (content.includes('newsletter') || content.includes('email')) requiredScore = 2;
        
        // Additional context checks
        const hasNewsletterIndicators = /(?:newsletter|digest|update|notification|alert|bulletin)/i.test(content);
        const hasMarketingIndicators = /(?:offer|sale|discount|promo|deal|limited time)/i.test(content);
        const hasSystemIndicators = /(?:notification|alert|security|verification|confirm)/i.test(content);
        
        if (hasNewsletterIndicators || hasMarketingIndicators || hasSystemIndicators) {
            requiredScore = Math.max(2, requiredScore - 1);
        }
        
        // Debugging info (can be removed in production)
        if (detectionScore >= requiredScore) {
            console.log(`✅ Pre-processed text detected (score: ${detectionScore}/${requiredScore}):`, matchedPatterns);
        } else if (detectionScore > 0) {
            console.log(`⚠️ Pre-processed indicators found but below threshold (score: ${detectionScore}/${requiredScore}):`, matchedPatterns);
        } else {
            console.log(`❌ No pre-processed indicators found`);
        }
        
        return detectionScore >= requiredScore;
    }

    /**
     * Process pre-processed text content into proper HTML
     * @param text - Pre-processed text content
     * @returns Formatted HTML content
     */
    processPreProcessedText(text: string): string {
        console.log('🔧 Processing pre-processed text:', text.substring(0, 200) + '...');
        
        let html = text;
        
        // Step 1: Clean up Unicode invisible characters and special entities
        html = html
            // Remove unicode invisible spacers and soft hyphens
            .replace(/[͏­]+/g, '')
            // Convert HTML entities to characters, then escape them properly
            .replace(/&zwnj;/gi, '') // Remove zero-width non-joiners
            .replace(/&shy;/gi, '') // Remove soft hyphens
            .replace(/&nbsp;/g, ' '); // Convert non-breaking spaces to regular spaces
        
        // Step 2: Escape HTML characters but preserve structure
        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Step 3: Convert URLs in various bracket formats to clickable links
        
        // URLs in parentheses: ( https://example.com )
        html = html.replace(
            /\(\s*(https?:\/\/[^\s)]+)\s*\)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="email-link">$1</a>'
        );
        
        // URLs in square brackets: [ https://example.com ]
        html = html.replace(
            /\[\s*(https?:\/\/[^\s\]]+)\s*\]/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="email-link">$1</a>'
        );
        
        // URLs in angle brackets: < https://example.com >
        html = html.replace(
            /&lt;\s*(https?:\/\/[^\s&]+)\s*&gt;/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="email-link">$1</a>'
        );
        
        // Step 4: Convert contextual URL patterns
        
        // Unsubscribe URLs with various separators
        html = html.replace(
            /unsubscribe\s*[:\-]?\s*(https?:\/\/[^\s<>"']+)/gi,
            'Unsubscribe: <a href="$1" target="_blank" rel="noopener noreferrer" class="email-unsubscribe-link">$1</a>'
        );
        
        // View in browser URLs
        html = html.replace(
            /view\s+in\s+browser\s*[:\-]?\s*(https?:\/\/[^\s<>"']+)/gi,
            'View in browser: <a href="$1" target="_blank" rel="noopener noreferrer" class="email-browser-link">$1</a>'
        );
        
        // Call-to-action URLs
        html = html.replace(
            /\b(click here|read more|learn more|get started|sign up|download|subscribe)\s*[:\-]?\s*(https?:\/\/[^\s<>"']+)/gi,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="email-cta-link">$1</a>'
        );
        
        // Step 5: Convert standalone URLs to links (but avoid double-processing)
        html = html.replace(
            /(?<!href=["']|>)(https?:\/\/[^\s<>"']+)(?![^<]*<\/a>)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="email-link">$1</a>'
        );
        
        // Step 6: Convert email addresses to mailto links (avoid already processed ones)
        html = html.replace(
            /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?![^<]*<\/a>)/gi,
            '<a href="mailto:$1" class="email-mailto">$1</a>'
        );
        
        // Step 7: Handle text formatting dividers
        html = html.replace(
            /(\*{10,}|\={10,}|\-{10,}|_{10,})/g,
            '<hr class="email-divider" style="border: 1px solid #ddd; margin: 20px 0;">'
        );
        
        // Step 8: Convert line breaks to HTML with improved handling
        // Handle multiple consecutive line breaks as paragraph separators
        html = html.replace(/\n\s*\n\s*\n+/g, '</p><p class="email-paragraph">'); // Triple+ breaks
        html = html.replace(/\n\n+/g, '</p><p class="email-paragraph">'); // Double breaks
        html = html.replace(/\n/g, '<br>'); // Single breaks
        
        // Step 9: Wrap in paragraphs
        html = `<p class="email-paragraph">${html}</p>`;
        
        // Step 10: Clean up empty paragraphs and fix structure
        html = html
            .replace(/<p class="email-paragraph">\s*<\/p>/g, '') // Remove empty paragraphs
            .replace(/<p class="email-paragraph">\s*<br>\s*<\/p>/g, '<br>') // Fix lone breaks in paragraphs
            .replace(/<p class="email-paragraph">\s*<hr([^>]*)>\s*<\/p>/g, '<hr$1>') // Fix dividers in paragraphs
            .replace(/(<\/p>)\s*(<p class="email-paragraph">)/g, '$1\n$2'); // Clean paragraph spacing
        
        // Step 11: Add enhanced email-specific styling with better typography
        html = `<div class="email-preprocessed-content" style="
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
        ">
            <style>
                .email-link { color: #1a73e8; text-decoration: none; }
                .email-link:hover { text-decoration: underline; }
                .email-unsubscribe-link { color: #666; font-size: 0.9em; }
                .email-browser-link { color: #1a73e8; font-weight: 500; }
                .email-cta-link { 
                    color: #1a73e8; 
                    font-weight: 600; 
                    text-decoration: none;
                    padding: 2px 4px;
                    border-radius: 3px;
                    background-color: rgba(26, 115, 232, 0.1);
                }
                .email-cta-link:hover { background-color: rgba(26, 115, 232, 0.2); }
                .email-mailto { color: #137333; }
                .email-paragraph { margin: 0 0 16px 0; }
                .email-divider { margin: 24px 0; border-color: #e8eaed; }
            </style>
            ${html}
        </div>`;
        
        return html;
    }

    /**
     * Extract and process a complete HTML email document
     * @param htmlDocument - Complete HTML document
     * @returns Processed HTML content with preserved styles
     */
    extractAndProcessFullHtmlDocument(htmlDocument: string): string {
        // Step 1: Extract CSS from head section
        const headCss = this.extractHeadCss(htmlDocument);
        
        // Step 2: Extract body content
        const bodyContent = this.extractBodyContent(htmlDocument);
        
        // Step 3: Process CSS for email display compatibility
        const processedCss = this.processEmailCss(headCss);
        
        // Step 4: Combine processed CSS and body content
        if (processedCss && processedCss.trim()) {
            return `<style type="text/css">${processedCss}</style>\n<div class="email-full-document">${bodyContent}</div>`;
        }
        
        return `<div class="email-full-document">${bodyContent}</div>`;
    }

    /**
     * Extract CSS from head section of HTML document
     * @param htmlDocument - Complete HTML document
     * @returns CSS content from head
     */
    extractHeadCss(htmlDocument: string): string {
        const cssBlocks: string[] = [];
        
        // Extract style tags from head
        const styleMatches = htmlDocument.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) {
            styleMatches.forEach(styleBlock => {
                const cssContent = styleBlock.replace(/<\/?style[^>]*>/gi, '').trim();
                if (cssContent) {
                    cssBlocks.push(cssContent);
                }
            });
        }
        
        // Extract linked CSS (convert to inline comments for reference)
        const linkMatches = htmlDocument.match(/<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi);
        if (linkMatches) {
            linkMatches.forEach(link => {
                const hrefMatch = link.match(/href\s*=\s*["']([^"']+)["']/);
                if (hrefMatch) {
                    cssBlocks.push(`/* External CSS: ${hrefMatch[1]} */`);
                }
            });
        }
        
        return cssBlocks.join('\n\n');
    }

    /**
     * Process CSS for email display compatibility
     * @param css - Raw CSS content
     * @returns Processed CSS suitable for email display
     */
    processEmailCss(css: string): string {
        if (!css || !css.trim()) return '';
        
        let processedCss = css;
        
        // Step 1: Preserve responsive media queries
        const mediaQueries = processedCss.match(/@media[^{]*{[^{}]*({[^{}]*}[^{}]*)*}/gi) || [];
        let coreCSS = processedCss;
        
        // Temporarily remove media queries to process core CSS
        mediaQueries.forEach((query, index) => {
            const placeholder = `/*MEDIA_QUERY_${index}*/`;
            coreCSS = coreCSS.replace(query, placeholder);
        });
        
        // Step 2: Normalize font families to web-safe fonts
        coreCSS = coreCSS.replace(
            /font-family\s*:\s*([^;}]+)/gi,
            (_match, fontList) => {
                const webSafeFonts = this.normalizeToWebSafeFonts(fontList);
                return `font-family: ${webSafeFonts}`;
            }
        );
        
        // Step 3: Add email-specific CSS prefixes for better compatibility
        coreCSS = coreCSS.replace(
            /(table\[class\s*=\s*["']?[^"']*["']?\])/gi,
            '$1, .email-table'
        );
        
        // Step 4: Ensure responsive images
        if (!coreCSS.includes('img') && !coreCSS.includes('image')) {
            coreCSS += '\n.email-full-document img { max-width: 100%; height: auto; }';
        }
        
        // Step 5: Add container constraints
        coreCSS += `
.email-full-document {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}`;
        
        // Step 6: Restore media queries
        mediaQueries.forEach((query, index) => {
            const placeholder = `/*MEDIA_QUERY_${index}*/`;
            coreCSS = coreCSS.replace(placeholder, query);
        });
        
        return coreCSS;
    }

    /**
     * Extract body content from HTML document
     * @param htmlDocument - Complete HTML document
     * @returns Body content
     */
    extractBodyContent(htmlDocument: string): string {
        // Extract content between <body> tags
        const bodyMatch = htmlDocument.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            return bodyMatch[1].trim();
        }
        
        // If no body tags, return the content after head
        const headEndMatch = htmlDocument.match(/<\/head>\s*([\s\S]*?)\s*<\/html>/i);
        if (headEndMatch) {
            return headEndMatch[1].trim();
        }
        
        // Fallback: return content without html/head structure
        return htmlDocument
            .replace(/<!DOCTYPE[^>]*>/gi, '')
            .replace(/<\/?html[^>]*>/gi, '')
            .replace(/<head[\s\S]*?<\/head>/gi, '')
            .replace(/<\/?body[^>]*>/gi, '')
            .trim();
    }

    /**
     * Analyze HTML structure to understand email layout patterns
     * @param html - HTML content
     * @returns Structure analysis result
     */
    analyzeHtmlStructure(html: string): EmailHtmlStructure {
        const structure: EmailHtmlStructure = {
            hasTablesLayout: false,
            hasInlineImages: false,
            hasComplexStyling: false,
            tableCount: 0,
            inlineStyleElements: 0,
            detectedEmailClient: 'generic',
            layoutType: 'simple'
        };

        // Count tables and analyze their purpose
        const tableMatches = html.match(/<table[^>]*>/gi) || [];
        structure.tableCount = tableMatches.length;
        structure.hasTablesLayout = structure.tableCount > 0;

        // Check for layout tables (common in email HTML)
        const layoutTableIndicators = [
            /cellpadding\s*=\s*["']?0["']?/i,
            /cellspacing\s*=\s*["']?0["']?/i,
            /border\s*=\s*["']?0["']?/i,
            /width\s*=\s*["']?\d+%?["']?/i,
            /style\s*=\s*["'][^"']*width\s*:\s*\d+[^"']*["']/i
        ];

        const hasLayoutTable = layoutTableIndicators.some(pattern => pattern.test(html));

        // Detect email client patterns
        if (html.includes('gmail') || html.includes('Google')) {
            structure.detectedEmailClient = 'gmail';
        } else if (html.includes('outlook') || html.includes('Microsoft')) {
            structure.detectedEmailClient = 'outlook';
        } else if (html.includes('Apple') || html.includes('Mail')) {
            structure.detectedEmailClient = 'apple-mail';
        }

        // Determine layout type
        if (structure.tableCount > 3 && hasLayoutTable) {
            structure.layoutType = 'table-based';
        } else if (structure.tableCount > 0 && (html.match(/<div[^>]*>/gi)?.length || 0) > 5) {
            structure.layoutType = 'mixed';
        } else if ((html.match(/<div[^>]*>/gi)?.length || 0) > 3) {
            structure.layoutType = 'div-based';
        }

        // Check for inline images
        structure.hasInlineImages = /<img[^>]*>/i.test(html) || /cid:/i.test(html);

        // Count elements with inline styles
        const inlineStyleMatches = html.match(/style\s*=\s*["'][^"']+["']/gi) || [];
        structure.inlineStyleElements = inlineStyleMatches.length;
        structure.hasComplexStyling = structure.inlineStyleElements > 10;

        return structure;
    }

    /**
     * Pre-process HTML for email-specific patterns and fixes
     * @param html - Raw HTML content
     * @param structure - HTML structure analysis
     * @returns Pre-processed HTML
     */
    preprocessEmailHtml(html: string, structure: EmailHtmlStructure): string {
        let processedHtml = html;

        // Check if this is email client HTML (be more conservative with modifications)
        const isEmailClientHtml = this.isEmailClientHtml(processedHtml);
        
        if (isEmailClientHtml) {
            // For email client HTML, be very conservative with changes
            processedHtml = this.preprocessEmailClientHtml(processedHtml, structure);
        } else {
            // For web HTML converted to email, apply more aggressive fixes
            processedHtml = this.preprocessWebHtml(processedHtml, structure);
        }

        return processedHtml;
    }

    /**
     * Check if HTML appears to be from an email client
     * @param html - HTML content
     * @returns True if appears to be email client HTML
     */
    isEmailClientHtml(html: string): boolean {
        const emailClientIndicators = [
            // Table-based layout patterns
            /cellpadding\s*=\s*["']?0["']?/i,
            /cellspacing\s*=\s*["']?0["']?/i,
            /border\s*=\s*["']?0["']?/i,
            // Email-specific CSS patterns
            /@media\s+only\s+screen/i,
            /table\[class\s*=\s*["']?body["']?\]/i,
            // Email client specific classes
            /class\s*=\s*["'][^"']*(?:container|wrapper|main-section)["']/i,
            // Tracking pixels
            /width\s*=\s*["']?1["']?\s+height\s*=\s*["']?1["']?/i,
            // Email service domains
            /(?:sendgrid|mailchimp|constantcontact|mailgun)\.(?:net|com)/i
        ];

        return emailClientIndicators.some(pattern => pattern.test(html));
    }

    /**
     * Conservative preprocessing for email client HTML
     * @param html - Email client HTML
     * @param structure - HTML structure analysis
     * @returns Minimally processed HTML
     */
    preprocessEmailClientHtml(html: string, structure: EmailHtmlStructure): string {
        let processedHtml = html;

        // Only essential fixes for email client HTML
        
        // 1. Ensure images have alt attributes (required for accessibility)
        processedHtml = processedHtml.replace(/<img([^>]*?)(?!\s+alt\s*=)([^>]*?)>/gi, '<img$1 alt=""$2>');
        
        // 2. Preserve but normalize whitespace
        processedHtml = this.normalizeEmailWhitespace(processedHtml);
        
        // 3. Handle email client specific quirks minimally
        if (structure.detectedEmailClient === 'gmail') {
            // Don't remove Gmail wrappers, just ensure they don't break
            processedHtml = this.preserveGmailStructure(processedHtml);
        }
        
        return processedHtml;
    }

    /**
     * More aggressive preprocessing for web HTML
     * @param html - Web HTML content
     * @param structure - HTML structure analysis
     * @returns Processed HTML
     */
    preprocessWebHtml(html: string, structure: EmailHtmlStructure): string {
        let processedHtml = html;

        // Apply more fixes for web HTML converted to email
        
        // 1. Remove problematic meta tags
        processedHtml = processedHtml.replace(/<meta[^>]*http-equiv[^>]*>/gi, '');
        
        // 2. Fix missing alt attributes on images
        processedHtml = processedHtml.replace(/<img([^>]*?)(?!\s+alt\s*=)([^>]*?)>/gi, '<img$1 alt=""$2>');
        
        // 3. Fix table structure issues
        processedHtml = this.fixTableStructure(processedHtml);
        
        // 4. Handle email client specific quirks
        if (structure.detectedEmailClient === 'gmail') {
            processedHtml = this.fixGmailQuirks(processedHtml);
        }
        
        if (structure.detectedEmailClient === 'outlook') {
            processedHtml = this.fixOutlookQuirks(processedHtml);
        }

        // 5. Normalize whitespace
        processedHtml = this.normalizeEmailWhitespace(processedHtml);

        return processedHtml;
    }

    /**
     * Preserve Gmail structure without breaking it
     * @param html - Gmail HTML
     * @returns HTML with preserved Gmail structure
     */
    preserveGmailStructure(html: string): string {
        // Don't remove Gmail divs, just ensure they have proper styling
        return html.replace(
            /<div([^>]*class\s*=\s*["'][^"']*gmail[^"']*["'][^>]*)>/gi,
            '<div$1 style="font-family: inherit; font-size: inherit;">'
        );
    }

    /**
     * Optimize table layouts for better email rendering
     * @param html - HTML with tables
     * @param _structure - Structure analysis (unused but kept for future use)
     * @returns Optimized HTML
     */
    optimizeTableLayout(html: string, _structure: EmailHtmlStructure): string {
        let optimizedHtml = html;

        // Add responsive table wrapper for mobile
        optimizedHtml = optimizedHtml.replace(
            /<table([^>]*class\s*=\s*["'][^"']*layout[^"']*["'][^>]*)>/gi,
            '<div class="email-table-wrapper"><table$1>'
        );

        // Close the wrapper
        optimizedHtml = optimizedHtml.replace(
            /<\/table>(?=[\s\S]*<div class="email-table-wrapper">)/gi,
            '</table></div>'
        );

        // Ensure table cells have proper display properties
        optimizedHtml = optimizedHtml.replace(
            /<td([^>]*)>/gi,
            (match, attributes) => {
                if (!attributes.includes('style=')) {
                    return `<td${attributes} style="display: table-cell; vertical-align: top;">`;
                } else if (!attributes.includes('display:') && !attributes.includes('vertical-align:')) {
                    return match.replace('style="', 'style="display: table-cell; vertical-align: top; ');
                }
                return match;
            }
        );

        // Fix table width issues
        optimizedHtml = optimizedHtml.replace(
            /<table([^>]*)>/gi,
            (match, attributes) => {
                if (!attributes.includes('width=') && !attributes.includes('width:')) {
                    return match.replace('<table', '<table width="100%"');
                }
                return match;
            }
        );

        return optimizedHtml;
    }

    /**
     * Process and optimize inline styles for email display
     * @param html - HTML with inline styles
     * @param options - Rendering options
     * @returns HTML with processed styles
     */
    processInlineStyles(html: string, options: EmailHtmlRenderOptions): string {
        let processedHtml = html;

        // Extract and normalize font styles
        processedHtml = processedHtml.replace(
            /style\s*=\s*["']([^"']*font-family:[^"']*?)["']/gi,
            (_match: string, styleContent: string) => {
                // Normalize font families to web-safe fonts
                let normalizedStyle = styleContent.replace(
                    /font-family\s*:\s*([^;]+)/gi,
                    (_fontMatch: string, fontList: string) => {
                        const webSafeFonts = this.normalizeToWebSafeFonts(fontList);
                        return `font-family: ${webSafeFonts}`;
                    }
                );
                return `style="${normalizedStyle}"`;
            }
        );

        // Handle max-width constraints
        if (options.maxWidth) {
            processedHtml = processedHtml.replace(
                /style\s*=\s*["']([^"']*?)["']/gi,
                (match, styleContent) => {
                    if (!styleContent.includes('max-width')) {
                        return `style="${styleContent}; max-width: ${options.maxWidth};"`;
                    }
                    return match;
                }
            );
        }

        // Enhance readability styles
        if (options.enhanceReadability) {
            processedHtml = this.enhanceReadabilityStyles(processedHtml);
        }

        return processedHtml;
    }

    /**
     * Process email images with comprehensive security and functionality
     * @param html - HTML with images
     * @param options - Rendering options
     * @param email - Full email object for attachment resolution
     * @returns Processing result with warnings
     */
    processEmailImages(html: string, options: EmailHtmlRenderOptions, email?: Email): { html: string; warnings: string[] } {
        let processedHtml = html;
        const warnings: string[] = [];
        const imageSecurityResults: Array<{src: string; action: string; reason: string}> = [];

        // Default security options
        const securityOptions = {
            allowExternalImages: options.allowExternalImages ?? true,
            allowNonHttpsImages: options.allowNonHttpsImages ?? false,
            blockTrackingPixels: options.blockTrackingPixels ?? true,
            showImageWarnings: options.showImageWarnings ?? true
        };

        // Step 1: Handle inline/embedded images (cid: URLs)
        const cidImages = html.match(/src\s*=\s*["']cid:[^"']*["']/gi) || [];
        if (cidImages.length > 0) {
            processedHtml = this.resolveCidImages(processedHtml, email, warnings);
        }

        // Step 2: Process external images with security checks
        processedHtml = processedHtml.replace(
            /<img([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi,
            (match, _beforeSrc, srcUrl, _afterSrc) => {
                // Skip if already processed (data URLs, cid URLs, etc.)
                if (srcUrl.startsWith('data:') || srcUrl.startsWith('cid:')) {
                    return this.enhanceImageElement(match, srcUrl);
                }

                const securityResult = this.checkImageSecurity(srcUrl, securityOptions);
                imageSecurityResults.push(securityResult);

                switch (securityResult.action) {
                    case 'block':
                        warnings.push(`Blocked image: ${securityResult.reason}`);
                        return this.createBlockedImageElement(srcUrl, securityResult.reason);
                        
                    case 'warn':
                        warnings.push(`Image warning: ${securityResult.reason}`);
                        return this.createWarningImageElement(match, srcUrl, securityResult.reason, securityOptions.showImageWarnings);
                        
                    case 'allow':
                    default:
                        return this.enhanceImageElement(match, srcUrl);
                }
            }
        );

        // Step 3: Add security summary if there were blocked/warned images
        if (imageSecurityResults.some(r => r.action !== 'allow') && securityOptions.showImageWarnings) {
            processedHtml = this.addImageSecurityNotice(processedHtml, imageSecurityResults);
        }

        return { html: processedHtml, warnings };
    }

    /**
     * Resolve cid: URLs to actual attachment content
     * @param html - HTML with cid URLs
     * @param email - Email object with attachments
     * @param warnings - Warnings array to append to
     * @returns HTML with resolved cid URLs
     */
    resolveCidImages(html: string, email: Email | undefined, warnings: string[]): string {
        if (!email || !email.attachments || email.attachments.length === 0) {
            warnings.push('Cannot resolve inline images: no email attachments available');
            return this.replaceCidWithPlaceholder(html);
        }

        return html.replace(
            /(<img[^>]*?)src\s*=\s*["']cid:([^"']+)["']([^>]*?>)/gi,
            (match, beforeSrc, contentId, afterSrc) => {
                // Find matching attachment by contentId
                const attachment = email.attachments?.find(att => 
                    att.contentId === contentId || 
                    att.contentId === `<${contentId}>` ||
                    att.contentId === contentId.replace(/[<>]/g, '')
                );

                if (attachment && attachment.content) {
                    try {
                        // Create data URL from attachment content
                        const mimeType = attachment.contentType || 'image/jpeg';
                        const content = typeof attachment.content === 'string' 
                            ? attachment.content 
                            : btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(attachment.content as ArrayBuffer))));
                        
                        const dataUrl = `data:${mimeType};base64,${content}`;
                        return `${beforeSrc}src="${dataUrl}" data-original-cid="${contentId}"${afterSrc}`;
                    } catch (error) {
                        console.warn('Error creating data URL for cid image:', error);
                        warnings.push(`Failed to resolve inline image: ${contentId}`);
                        return this.createPlaceholderImage(match, `Failed to load: ${contentId}`);
                    }
                } else {
                    warnings.push(`Inline image not found in attachments: ${contentId}`);
                    return this.createPlaceholderImage(match, `Missing attachment: ${contentId}`);
                }
            }
        );
    }

    checkImageSecurity(srcUrl: string, _options: any): { src: string; action: string; reason: string } {
        return { src: srcUrl, action: 'allow', reason: '' };
    }

    enhanceImageElement(match: string, _srcUrl: string): string {
        return match;
    }

    createBlockedImageElement(_src: string, reason: string): string {
        return `<div class="blocked-image">Image blocked: ${reason}</div>`;
    }

    createWarningImageElement(match: string, _srcUrl: string, _reason: string, _show: boolean): string {
        return match;
    }

    createPlaceholderImage(_match: string, message: string): string {
        return `<div class="placeholder-image">${message}</div>`;
    }

    replaceCidWithPlaceholder(html: string): string {
        return html.replace(/src\s*=\s*["']cid:[^"']*["']/gi, 'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"');
    }

    addImageSecurityNotice(html: string, _results: any[]): string {
        return html;
    }

    applyEmailOptimizations(html: string, _structure: EmailHtmlStructure, _options: EmailHtmlRenderOptions): string {
        return `<div class="email-content">${html}</div>`;
    }

    sanitizeEmailHtml(html: string, _level: string): string {
        return html;
    }

    wrapInEmailContainer(html: string, _structure: EmailHtmlStructure, _options: EmailHtmlRenderOptions): string {
        return `<div class="email-html-content">${html}</div>`;
    }

    looksLikeHtml(content: string): boolean {
        return /<[a-z][\s\S]*>/i.test(content);
    }

    convertTextToHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    createEmptyStructure(): EmailHtmlStructure {
        return {
            hasTablesLayout: false,
            hasInlineImages: false,
            hasComplexStyling: false,
            tableCount: 0,
            inlineStyleElements: 0,
            detectedEmailClient: 'generic',
            layoutType: 'simple'
        };
    }

    fixTableStructure(html: string): string {
        return html;
    }

    fixGmailQuirks(html: string): string {
        return html;
    }

    fixOutlookQuirks(html: string): string {
        return html;
    }

    normalizeEmailWhitespace(html: string): string {
        return html;
    }

    normalizeToWebSafeFonts(fontList: string): string {
        return fontList + ', Arial, sans-serif';
    }

    enhanceReadabilityStyles(html: string): string {
        return html;
    }

    validateDependencies(): { isValid: boolean; missing: string[] } {
        const missing: string[] = [];

        if (typeof (globalThis as any).SafeHTML === 'undefined') {
            missing.push('SafeHTML');
        }

        if (typeof (globalThis as any).DOMPURIFY_CONFIG === 'undefined') {
            missing.push('DOMPURIFY_CONFIG');
        }

        if (typeof document === 'undefined') {
            missing.push('DOM document');
        }

        return {
            isValid: missing.length === 0,
            missing
        };
    }

    /**
     * Detect if HTML contains table-related tags
     * @param content - HTML content
     * @returns True if any table-related tags are present
     */
    containsTableHtml(content: string): boolean {
        return /<(table|tr|td|th|tbody|thead|tfoot)[\s>]/i.test(content);
    }
}

export { EmailHtmlEngine, type EmailHtmlParseResult, type EmailHtmlStructure, type EmailHtmlRenderOptions };