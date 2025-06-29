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
        
        console.log('[DEBUG] processEmailHtml: Starting processing...');
        
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
        console.log('[DEBUG] processEmailHtml: Step 1 - Extracting HTML content...');
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
        console.log('[DEBUG] processEmailHtml: Step 2 - Early table processing...');
        let processedHtml = htmlContent;
        const hasTables = this.containsTableHtml(htmlContent);
        if (hasTables) {
            console.log('[DEBUG] Before optimizeTableLayout:', processedHtml.substring(0, 1000));
            processedHtml = this.optimizeTableLayout(processedHtml, this.createEmptyStructure());
            console.log('[DEBUG] After optimizeTableLayout:', processedHtml.substring(0, 1000));
            processingSteps.push('Early table layout optimization applied');
        }

        // Step 3: Analyze HTML structure (after table processing)
        console.log('[DEBUG] processEmailHtml: Step 3 - Analyzing HTML structure...');
        const structure = this.analyzeHtmlStructure(processedHtml);
        processingSteps.push(`Analyzed structure: ${structure.layoutType} layout, ${structure.tableCount} tables`);

        // Step 4: Pre-process HTML for email-specific patterns
        console.log('[DEBUG] Before preprocessEmailHtml:', processedHtml.substring(0, 1000));
        processedHtml = this.preprocessEmailHtml(processedHtml, structure);
        console.log('[DEBUG] After preprocessEmailHtml:', processedHtml.substring(0, 1000));
        processingSteps.push('Pre-processed email HTML patterns');

        // Step 5: Process inline styles
        console.log('[DEBUG] Before processInlineStyles check:', {
            hasComplexStyling: structure.hasComplexStyling,
            inlineStyleElements: structure.inlineStyleElements,
            willCallProcessInlineStyles: structure.hasComplexStyling
        });
        
        if (structure.hasComplexStyling) {
            console.log('[DEBUG] Calling processInlineStyles...');
            processedHtml = this.processInlineStyles(processedHtml, fullOptions);
            processingSteps.push('Processed inline styles');
            console.log('[DEBUG] processInlineStyles completed');
        } else {
            console.log('[DEBUG] Skipping processInlineStyles - hasComplexStyling is false');
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

        // Step 8.5: Gmail-style flattening of footer/social block tables
        processedHtml = this.flattenFooterTablesGmailStyle(processedHtml);
        processingSteps.push('Flattened footer/social block tables (Gmail-style)');

        // Step 9: Wrap in email container with proper styling
        const finalHtml = this.wrapInEmailContainer(processedHtml, structure, fullOptions);
        processingSteps.push('Wrapped in email display container');

        console.log('✅ Email processing complete:', {
            messageId: email.messageId || email.id,
            finalHtmlLength: finalHtml.length,
            processingSteps,
            warnings
        });

        // Search for the problematic td element after processing
        const problematicTdMatchAfter = processedHtml.match(/<td[^>]*style="[^"]*proxima-nova[^"]*"[^>]*>/i);
        if (problematicTdMatchAfter) {
            console.log('[DEBUG] Found problematic td element AFTER processing:', problematicTdMatchAfter[0]);
        }
        
        // Search for "Connect With Us" td element after processing
        const connectWithUsMatchAfter = processedHtml.match(/<td[^>]*style="[^"]*Connect With Us[^"]*"[^>]*>/i);
        if (connectWithUsMatchAfter) {
            console.log('[DEBUG] Found "Connect With Us" td element AFTER processing:', connectWithUsMatchAfter[0]);
        }
        
        // Search for td elements with generic styles after processing
        const genericStyleMatchesAfter = processedHtml.match(/<td[^>]*style="[^"]*display: table-cell; vertical-align: top[^"]*"[^>]*>/gi);
        if (genericStyleMatchesAfter && genericStyleMatchesAfter.length > 0) {
            console.log('[DEBUG] Found td elements with generic styles AFTER processing:', genericStyleMatchesAfter.length);
            console.log('[DEBUG] First few generic style matches AFTER processing:', genericStyleMatchesAfter.slice(0, 3));
        }

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

        // Count elements with inline styles - improved regex to catch more patterns
        const inlineStyleMatches = html.match(/style\s*=\s*["'][^"']*["']/gi) || [];
        const inlineStyleMatches2 = html.match(/style\s*=\s*[""][^""]*[""]/gi) || [];
        const allInlineStyleMatches = [...inlineStyleMatches, ...inlineStyleMatches2];
        structure.inlineStyleElements = allInlineStyleMatches.length;
        structure.hasComplexStyling = structure.inlineStyleElements > 1; // TEMPORARILY CHANGED FROM 10 TO 1 FOR TESTING
        
        console.log('[DEBUG] Inline style analysis:', {
            totalMatches: allInlineStyleMatches.length,
            singleQuoteMatches: inlineStyleMatches.length,
            doubleQuoteMatches: inlineStyleMatches2.length,
            firstFewMatches: allInlineStyleMatches.slice(0, 3),
            hasComplexStyling: structure.hasComplexStyling
        });
        
        console.log('[DEBUG] analyzeHtmlStructure results:', {
            inlineStyleElements: structure.inlineStyleElements,
            hasComplexStyling: structure.hasComplexStyling,
            tableCount: structure.tableCount,
            hasTablesLayout: structure.hasTablesLayout,
            layoutType: structure.layoutType,
            detectedEmailClient: structure.detectedEmailClient
        });

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
                // Only add generic styles if no style attribute exists AND no other styling attributes
                if (!attributes.includes('style=') && 
                    !attributes.includes('width=') && 
                    !attributes.includes('valign=') && 
                    !attributes.includes('align=') && 
                    !attributes.includes('bgcolor=') && 
                    !attributes.includes('class=')) {
                    return `<td${attributes} style="display: table-cell; vertical-align: top;">`;
                }
                // If any styling attributes exist, preserve them completely - don't modify
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
        console.log('[DEBUG] processInlineStyles input:', html.substring(0, 1000));
        
        // Search for the specific problematic td element
        const problematicTdMatch = html.match(/<td[^>]*style="[^"]*proxima-nova[^"]*"[^>]*>/i);
        if (problematicTdMatch) {
            console.log('[DEBUG] Found problematic td element:', problematicTdMatch[0]);
        }
        
        // Search for "Connect With Us" td element
        const connectWithUsMatch = html.match(/<td[^>]*style="[^"]*Connect With Us[^"]*"[^>]*>/i);
        if (connectWithUsMatch) {
            console.log('[DEBUG] Found "Connect With Us" td element:', connectWithUsMatch[0]);
        }
        
        // Search for td elements with generic styles that might be getting prepended
        const genericStyleMatches = html.match(/<td[^>]*style="[^"]*display: table-cell; vertical-align: top[^"]*"[^>]*>/gi);
        if (genericStyleMatches && genericStyleMatches.length > 0) {
            console.log('[DEBUG] Found td elements with generic styles:', genericStyleMatches.length);
            console.log('[DEBUG] First few generic style matches:', genericStyleMatches.slice(0, 3));
        }
        
        let processedHtml = html;

        // Use DOMParser for robust style manipulation
        if (typeof window !== 'undefined' && window.DOMParser && options.maxWidth) {
            const parser = new window.DOMParser();
            const doc = parser.parseFromString(processedHtml, 'text/html');
            doc.querySelectorAll('[style]').forEach((el) => {
                const style = el.getAttribute('style') || '';
                const tagName = el.tagName.toLowerCase();
                
                // Only add max-width to elements that need responsive behavior
                // Skip elements that already have max-width or specific styling that should be preserved
                if (!/max-width\s*:/.test(style)) {
                    let shouldAddMaxWidth = false;
                    
                    if (tagName === 'img') {
                        shouldAddMaxWidth = true;
                    } else if (tagName === 'table') {
                        shouldAddMaxWidth = true;
                    } else if (tagName === 'td') {
                        // Only add max-width to td elements that are simple/generic
                        // Skip td elements with complex styling (fonts, colors, padding, etc.)
                        const hasComplexStyling = /(font-family|font-size|color|padding|margin|background|border|text-align|vertical-align)/.test(style);
                        shouldAddMaxWidth = !hasComplexStyling;
                    }
                    
                    if (shouldAddMaxWidth) {
                        el.setAttribute('style', style.replace(/;?$/, `; max-width: ${options.maxWidth};`));
                    }
                }
            });
            processedHtml = doc.body.innerHTML;
        }

        // Enhance readability styles only if requested
        if (options.enhanceReadability) {
            processedHtml = this.enhanceReadabilityStyles(processedHtml);
        }
        
        // Search for the problematic td element after processing
        const problematicTdMatchAfter = processedHtml.match(/<td[^>]*style="[^"]*proxima-nova[^"]*"[^>]*>/i);
        if (problematicTdMatchAfter) {
            console.log('[DEBUG] Found problematic td element AFTER processing:', problematicTdMatchAfter[0]);
        }
        
        // Search for "Connect With Us" td element after processing
        const connectWithUsMatchAfter = processedHtml.match(/<td[^>]*style="[^"]*Connect With Us[^"]*"[^>]*>/i);
        if (connectWithUsMatchAfter) {
            console.log('[DEBUG] Found "Connect With Us" td element AFTER processing:', connectWithUsMatchAfter[0]);
        }
        
        // Search for td elements with generic styles after processing
        const genericStyleMatchesAfter = processedHtml.match(/<td[^>]*style="[^"]*display: table-cell; vertical-align: top[^"]*"[^>]*>/gi);
        if (genericStyleMatchesAfter && genericStyleMatchesAfter.length > 0) {
            console.log('[DEBUG] Found td elements with generic styles AFTER processing:', genericStyleMatchesAfter.length);
            console.log('[DEBUG] First few generic style matches AFTER processing:', genericStyleMatchesAfter.slice(0, 3));
        }
        
        console.log('[DEBUG] processInlineStyles output:', processedHtml.substring(0, 1000));
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

    /**
     * Gmail-style: Flatten table structure for likely footer/social blocks
     * - Looks at the last 1-3 tables in the email body
     * - If a table contains 2+ social/media links/icons, it is flattened (wrappers removed)
     * - Uses DOM, not regex, for safety
     * @param html - HTML content
     * @returns HTML with flattened footer/social block tables
     */
    flattenFooterTablesGmailStyle(html: string): string {
        if (typeof window === 'undefined' || !window.DOMParser) return html;
        try {
            const parser = new window.DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const tables = Array.from(doc.querySelectorAll('table'));
            // Only look at the last 3 tables in the body
            const candidateTables = tables.slice(-3);
            let didFlatten = false;
            candidateTables.forEach(table => {
                // Heuristic: 2+ <a> with <img> (social/media icons)
                const socialLinks = Array.from(table.querySelectorAll('a > img'));
                if (socialLinks.length >= 2) {
                    // --- Enhanced flattening and centering ---
                    // 1. Collect all <a><img></a> parents (the <a> tags)
                    const iconLinks = socialLinks.map(img => img.parentElement as HTMLElement).filter(Boolean);

                    // 2. Remove all existing rows in the table
                    while (table.rows.length) table.deleteRow(0);

                    // 3. Optionally, find any text content (e.g., "Connect With Us")
                    let textContent = '';
                    // Look for <p>, <span>, or text nodes in the table that are not inside <a>
                    table.querySelectorAll('p, span, td, div').forEach(el => {
                        if (!el.querySelector('a > img') && el.textContent && el.textContent.trim().length > 0) {
                            const txt = el.textContent.trim();
                            if (txt.length > 0 && txt.length < 64 && /connect|follow|social|stay|in touch|with us/i.test(txt)) {
                                textContent = txt;
                            }
                        }
                    });

                    // 4. Create a new row for the text (if found)
                    if (textContent) {
                        const textRow = table.ownerDocument.createElement('tr');
                        const textTd = table.ownerDocument.createElement('td');
                        textTd.colSpan = iconLinks.length;
                        textTd.setAttribute('align', 'center');
                        textTd.setAttribute('style', 'text-align:center; font-weight:bold; font-size:16px; padding-bottom:8px;');
                        textTd.textContent = textContent;
                        textRow.appendChild(textTd);
                        table.appendChild(textRow);
                    }

                    // 5. Create a new row for the icons
                    const iconRow = table.ownerDocument.createElement('tr');
                    iconLinks.forEach(icon => {
                        const td = table.ownerDocument.createElement('td');
                        td.setAttribute('align', 'center');
                        td.setAttribute('style', 'text-align:center; padding:0 8px;');
                        td.appendChild(icon.cloneNode(true));
                        iconRow.appendChild(td);
                    });
                    table.appendChild(iconRow);

                    // 6. Set table alignment and style
                    table.setAttribute('align', 'center');
                    table.setAttribute('style', 'margin:0 auto;');

                    didFlatten = true;
                }
            });
            if (didFlatten) {
                return doc.body.innerHTML;
            }
        } catch (e) {
            // Fallback: return original HTML
            return html;
        }
        return html;
    }
}

export { EmailHtmlEngine, type EmailHtmlParseResult, type EmailHtmlStructure, type EmailHtmlRenderOptions };