/**
 * Email Renderer - Simplified and streamlined email display module
 * Integrated with EmailHtmlEngine for advanced HTML processing
 */

import { Email, EmailAddress } from '../../types/email';
import { GmailStyleProcessor } from '../email/gmail-style-processor.js';
import { emailProcessingConfig } from '../config/email-processing-config.js';

// Email rendering interfaces
interface EmailCompatibleHtmlOptions {
    headerText?: string;
    footerText?: string;
    backgroundColor?: string;
    contentBackgroundColor?: string;
    textColor?: string;
    linkColor?: string;
    borderColor?: string;
    maxWidth?: string;
    fontSize?: string;
    fontFamily?: string;
    padding?: string;
    borderRadius?: string;
    boxShadow?: string;
}

class EmailRenderer {
    private gmailProcessor: GmailStyleProcessor;

    constructor() {
        this.gmailProcessor = new GmailStyleProcessor();
        console.log('EmailRenderer: Initialized with GmailStyleProcessor');
        
        // Set up event delegation for attachment buttons
        this.setupAttachmentEventListeners();
    }

    /**
     * Set up event delegation for attachment buttons
     */
    setupAttachmentEventListeners(): void {
        // Remove existing listener if it exists
        document.removeEventListener('click', this.handleAttachmentClick);
        
        // Add event delegation for attachment buttons
        document.addEventListener('click', this.handleAttachmentClick.bind(this));
    }

    /**
     * Handle attachment button clicks
     */
    private handleAttachmentClick(event: Event): void {
        const target = event.target as HTMLElement;
        
        // Check if clicked element is an attachment button
        if (!target.classList.contains('attachment-btn')) {
            return;
        }
        
        const action = target.getAttribute('data-action');
        const attachmentIndex = target.getAttribute('data-attachment-index');
        
        if (!action || attachmentIndex === null) {
            return;
        }
        
        // Find the attachment item container
        const attachmentItem = target.closest('.attachment-item');
        if (!attachmentItem) {
            return;
        }
        
        // Get attachment data from the container
        const attachmentDataStr = attachmentItem.getAttribute('data-attachment');
        if (!attachmentDataStr) {
            return;
        }
        
        try {
            const attachmentData = JSON.parse(attachmentDataStr);
            
            // Call the appropriate AttachmentHandler method
            if ((window as any).AttachmentHandler) {
                (async () => {
                    try {
                        switch (action) {
                            case 'download':
                                await (window as any).AttachmentHandler.downloadAttachment(attachmentData);
                                break;
                            case 'preview':
                                await (window as any).AttachmentHandler.previewAttachment(attachmentData);
                                break;
                            case 'openInCloud':
                                (window as any).AttachmentHandler.openInCloud(attachmentData);
                                break;
                            case 'delete':
                                (window as any).AttachmentHandler.deleteAttachment(attachmentData);
                                break;
                        }
                    } catch (error) {
                        console.error('Error handling attachment action:', error);
                        if (typeof (window as any).showNotification !== 'undefined') {
                            (window as any).showNotification('Failed to perform attachment action: ' + (error as Error).message, 'error');
                        }
                    }
                })();
            }
        } catch (error) {
            console.error('Error handling attachment click:', error);
        }
    }

    /**
     * Validate that required dependencies are available
     * @returns True if all dependencies are available
     */
    validateDependencies(): boolean {
        const missing: string[] = [];
        
        if (typeof (globalThis as any).SafeHTML === 'undefined') {
            missing.push('SafeHTML');
        }
        
        if (typeof (globalThis as any).AttachmentHandler === 'undefined') {
            missing.push('AttachmentHandler');
        }
        
        if (missing.length > 0) {
            console.error('EmailRenderer module missing dependencies:', missing);
            return false;
        }
        
        return true;
    }

    /**
     * Escape HTML characters
     * @param text - Text to escape
     * @returns Escaped text
     */
    escapeHtml(text: string): string {
        if (typeof text !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Create email thread item for display
     * @param email - Email object
     * @param isExpanded - Whether the email is expanded
     * @returns Email thread item element
     */
    createEmailThreadItem(email: Email, isExpanded: boolean = false): HTMLElement {
        console.log('EmailRenderer.createEmailThreadItem called with email:', email);
        console.log('Email messageId:', email.messageId, 'Type:', typeof email.messageId, 'Depth:', (email as any).depth);
        
        // Validate email object
        if (!email) {
            throw new Error('Email object is null or undefined');
        }
        
        const emailElement = document.createElement('div');
        const depth = (email as any).depth || 0;
        const threadDepthClass = depth > 0 ? `thread-depth-${Math.min(depth, 5)}` : '';
        emailElement.className = `gmail-thread-item ${isExpanded ? 'expanded' : ''} ${threadDepthClass}`;
        
        // Add thread hierarchy styling
        if (depth > 0) {
            emailElement.style.marginLeft = `${Math.min(depth * 20, 100)}px`;
            emailElement.style.borderLeft = '2px solid #e8eaed';
            emailElement.style.paddingLeft = '8px';
        }
        
        // Ensure messageId is a string for consistency
        const messageId = String(email.messageId || email.id || 'unknown-' + Date.now());
        emailElement.setAttribute('data-message-id', messageId);
        emailElement.setAttribute('data-thread-depth', String(depth));
        console.log('Set data-message-id to:', messageId, 'with depth:', depth);
        
        // Parse sender information with fallbacks
        let senderName = 'Unknown Sender';
        let senderEmail = '';
        
        try {
            if (email.from) {
                if (typeof email.from === 'string') {
                    // Parse "Name <email@domain.com>" format
                    const fromStr = email.from as string;
                    const match = fromStr.match(/^(.+?)\s*<(.+?)>$/) || fromStr.match(/^(.+)$/);
                    if (match) {
                        if (match[2]) {
                            senderName = match[1].trim();
                            senderEmail = match[2].trim();
                        } else {
                            // Just an email address
                            senderEmail = match[1].trim();
                            senderName = senderEmail.split('@')[0]; // Use email prefix as name
                        }
                    }
                } else if (typeof email.from === 'object') {
                    senderName = email.from.name || email.from.email || 'Unknown Sender';
                    senderEmail = email.from.email || '';
                }
            }
        } catch (error) {
            console.warn('Error parsing sender information:', error, email.from);
        }
        
        // Generate clean preview text using helper function with error handling
        let truncatedPreview = '';
        try {
            truncatedPreview = this.generatePreviewText(email, 80);
        } catch (error) {
            console.warn('Error generating preview text:', error);
            truncatedPreview = 'Preview not available';
        }
        
        // Format timestamp with error handling
        let timestamp = '';
        try {
            timestamp = this.formatEmailDate(email.date);
        } catch (error) {
            console.warn('Error formatting email date:', error, email.date);
            timestamp = 'Date unknown';
        }
        
        // Parse recipients for display with error handling
        let toList: EmailAddress[] = [];
        
        try {
            toList = Array.isArray(email.to) ? email.to : [email.to].filter(Boolean);
        } catch (error) {
            console.warn('Error parsing recipients:', error);
            toList = [];
        }
        
        // Get receiver name from toList
        let receiverName = 'Unknown Receiver';
        try {
            if (toList && toList.length > 0) {
                const firstRecipient = toList[0];
                if (typeof firstRecipient === 'object' && firstRecipient.name) {
                    receiverName = firstRecipient.name;
                } else if (typeof firstRecipient === 'object' && firstRecipient.email) {
                    receiverName = firstRecipient.email.split('@')[0];
                } else if (typeof firstRecipient === 'string') {
                    // Parse "Name <email@domain.com>" format or just email
                    const recipientStr = firstRecipient as string;
                    const match = recipientStr.match(/^(.+?)\s*<(.+?)>$/) || recipientStr.match(/^(.+)$/);
                    if (match) {
                        if (match[2]) {
                            receiverName = match[1].trim();
                        } else {
                            receiverName = match[1].trim().split('@')[0];
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Error parsing receiver information:', error);
        }

        // Gmail-style thread header with hierarchy indicators
        try {
            // Add reply indicator for threaded emails
            const replyIndicator = depth > 0 ? 
                `<span class="thread-reply-indicator" title="Reply (depth: ${depth})">
                    <i class="fas fa-reply" style="font-size: 10px; color: #5f6368; margin-right: 4px;"></i>
                </span>` : '';
            
            // Add parent email info for replies
            const parentId = (email as any).parentId;
            const parentInfo = parentId ? 
                `<span class="thread-parent-info" style="font-size: 11px; color: #5f6368; margin-left: 8px;">
                    (in reply to ${parentId.substring(0, 8)}...)
                </span>` : '';
            
            emailElement.innerHTML = `
                <div class="gmail-thread-header" onclick="toggleEmailExpansion('${messageId}')">
                    <div class="gmail-thread-info">
                        <div class="gmail-sender-line">
                            ${replyIndicator}
                            <span class="gmail-sender-name">${this.escapeHtml(senderName)}</span>
                            <span class="gmail-to-text"> to </span>
                            <span class="gmail-receiver-name">${this.escapeHtml(receiverName)}</span>
                            ${parentInfo}
                        </div>
                        <div class="gmail-thread-preview">
                            ${isExpanded ? 'Click to collapse' : this.escapeHtml(truncatedPreview)}
                        </div>
                    </div>
                    <div class="gmail-thread-meta">
                        <span class="gmail-thread-time">${this.escapeHtml(timestamp)}</span>
                        ${depth > 0 ? `<span class="thread-depth-badge" title="Reply depth: ${depth}">↳${depth}</span>` : ''}
                    </div>
                </div>
            `;
            
            // Add expanded content if needed
            if (isExpanded) {
                try {
                    const expandedContent = this.createExpandedContent(email);
                    emailElement.appendChild(expandedContent);
                } catch (error) {
                    console.error('Error creating expanded content:', error);
                    // Add error message in expanded view
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'gmail-expanded-content error';
                    errorDiv.innerHTML = `
                        <div class="gmail-email-content">
                            <p><em>Error loading email content</em></p>
                            <details>
                                <summary>Error Details</summary>
                                <pre>${(error as Error).message}</pre>
                            </details>
                        </div>
                    `;
                    emailElement.appendChild(errorDiv);
                }
            }
            
            console.log('Created email thread item for messageId:', messageId);
            return emailElement;
            
        } catch (error) {
            console.error('Error creating email thread item HTML:', error);
            throw error;
        }
    }

    /**
     * Format email date for display
     * @param date - Email date
     * @returns Formatted date
     */
    formatEmailDate(date: string | Date): string {
        if (!date) return '';
        
        const emailDate = new Date(date);
        const month = emailDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const day = emailDate.getDate();
        
        return `${month} ${day}`;
    }

    /**
     * Format detailed date for email display
     * @param date - Email date
     * @returns Detailed formatted date
     */
    formatDetailedDate(date: string | Date): string {
        if (!date) return '';
        
        const emailDate = new Date(date);
        return emailDate.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Generate clean preview text from email content
     * @param email - Email object
     * @param maxLength - Maximum length of preview text
     * @returns Preview text
     */
    generatePreviewText(email: Email, maxLength: number = 80): string {
        let preview = '';
        
        // Try different content sources
        const emailText = (email as any).text;
        const emailBody = email.body;
        
        if (emailText && emailText.trim()) {
            preview = emailText.trim();
        } else if (emailBody && emailBody.trim()) {
            preview = emailBody
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim();
        }
        
        const firstLine = preview.split('\n')[0] || 'No content available';
        return firstLine.length > maxLength ? 
            firstLine.substring(0, maxLength) + '...' : firstLine;
    }

    /**
     * Create expanded content with automatic processing mode selection
     * @param email - Email object
     * @param options - Optional render options
     * @returns Expanded content element
     */
    createExpandedContent(email: Email, options: any = {}): HTMLElement {
        const processingMode = emailProcessingConfig.detectProcessingMode(email);
        if (processingMode === 'gmail-style') {
            return this.createGmailExpandedContent(email, options);
        } else {
            return this.createGmailExpandedContent(email, options);
        }
    }

    /**
     * Create Gmail-style expanded content using GmailStyleProcessor
     * @param email - Email object
     * @param options - Optional render options
     * @returns Expanded content element
     */
    createGmailExpandedContent(email: Email, _options: any = {}): HTMLElement {
        // Debug: Log the email object and its attachments
        console.log('[DEBUG] Rendering email in createGmailExpandedContent:', email);
        console.log('[DEBUG] Attachments:', email.attachments);
        (window as any).lastRenderedEmail = email;
        const expandedDiv = document.createElement('div');
        expandedDiv.className = 'gmail-expanded-content';
        try {
            // Use Gmail-style processor for authentic Gmail experience
            const gmailOptions = {
                preserveGmailStructure: true,
                handleGmailQuirks: true,
                applyGmailStyling: true,
                processGmailTables: true,
                sanitizeGmailContent: true,
                enableGmailResponsive: true
            };
            const gmailResult = this.gmailProcessor.processGmailStyle(email, gmailOptions);
            // Check if the processed result is the 'No content available' message
            const isNoHtmlContent = gmailResult.content && gmailResult.content.includes('No content available');
            let contentHtml = '';
            if (isNoHtmlContent) {
                // Try to render plain text fallback
                let plainText = (email as any).text || email.bodyText || email.body || email.snippet || '';
                plainText = plainText.trim();
                if (plainText) {
                    contentHtml = this.convertPlainTextToHtml(plainText);
                } else {
                    contentHtml = '<em>No content available</em>';
                }
            } else {
                contentHtml = gmailResult.content;
            }
            // Render attachments below the content
            const attachmentsHtml = this.renderAttachmentList(email.attachments || []);
            expandedDiv.innerHTML = `
                <div class="email-content">
                    ${contentHtml}
                </div>
                <div class="email-attachments">
                    ${attachmentsHtml}
                </div>
            `;
            // Log Gmail processing information for debugging
            if (gmailResult.warnings.length > 0) {
                console.warn('Gmail-style processing warnings:', gmailResult.warnings);
            }
            if (gmailResult.processingSteps.length > 0) {
                console.log('Gmail-style processing steps:', gmailResult.processingSteps);
            }
            if (gmailResult.gmailFeatures) {
                console.log('Gmail features detected:', gmailResult.gmailFeatures);
            }
        } catch (error) {
            console.error('Error processing email with Gmail-style processor:', error);
            // Fallback to standard HTML engine
            try {
                // Fallback to plain text since EmailHtmlEngine was removed
                let plainText = (email as any).text || email.bodyText || email.body || email.snippet || '';
                plainText = plainText.trim();
                let content = '';
                if (plainText) {
                    content = this.convertPlainTextToHtml(plainText);
                } else {
                    content = '<em>No content available</em>';
                }
                
                expandedDiv.innerHTML = `
                    <div class="email-content">
                        <div class="email-content-wrapper">
                            ${content}
                        </div>
                    </div>
                `;
            } catch (fallbackError) {
                console.error('Fallback processing also failed:', fallbackError);
                expandedDiv.innerHTML = `
                    <div class="email-content">
                        <div class="email-content-wrapper">
                            <em>Error processing email content</em>
                        </div>
                    </div>
                `;
            }
        }
        return expandedDiv;
    }

    /**
     * Convert plain text to HTML
     * @param text - Plain text
     * @returns HTML content
     */
    convertPlainTextToHtml(text: string): string {
        if (!text) return '';
        let raw = text;
        const linkPlaceholders: { ph: string; html: string }[] = [];
        let placeholderIdx = 0;
        // Helper to generate a unique placeholder
        const makePlaceholder = () => `__LINK_PLACEHOLDER_${placeholderIdx++}__`;
        // 1. Pseudo-HTML links: https://.../" target="_blank" rel="noopener noreferrer">Text
        raw = raw.replace(
            /(https?:\/\/[^\s<>"]+)" target="_blank" rel="noopener noreferrer">([^<\n]+)/g,
            (_, url, label) => {
                const ph = makePlaceholder();
                linkPlaceholders.push({ ph, html: `<a href=\"${url}\" target=\"_blank\" rel=\"noopener noreferrer\">${label}</a>` });
                return ph;
            }
        );
        // 2. Markdown-style links [text](url)
        raw = raw.replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
            (_, label, url) => {
                const ph = makePlaceholder();
                linkPlaceholders.push({ ph, html: `<a href=\"${url}\" target=\"_blank\" rel=\"noopener noreferrer\">${label}</a>` });
                return ph;
            }
        );
        // 3. URLs in square brackets [https://...]
        raw = raw.replace(
            /\[\s*(https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+[\w\-_/~#?=&%])\s*\]/gi,
            (_, url) => {
                const ph = makePlaceholder();
                linkPlaceholders.push({ ph, html: `<a href=\"${url}\" target=\"_blank\" rel=\"noopener noreferrer\">${url}</a>` });
                return ph;
            }
        );
        // 4. Bare URLs
        raw = raw.replace(
            /(https?:\/\/[^\s<>")\]\']+)/gi,
            (_, url) => {
                const ph = makePlaceholder();
                linkPlaceholders.push({ ph, html: `<a href=\"${url}\" target=\"_blank\" rel=\"noopener noreferrer\">${url}</a>` });
                return ph;
            }
        );
        // 5. Email addresses
        raw = raw.replace(
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            (_, email) => {
                const ph = makePlaceholder();
                linkPlaceholders.push({ ph, html: `<a href=\"mailto:${email}\">${email}</a>` });
                return ph;
            }
        );
        // 6. Escape the entire string
        let html = this.escapeHtml(raw);
        // 7. Replace placeholders with actual links (unescaped)
        for (const entry of linkPlaceholders) {
            html = html.replace(entry.ph, entry.html);
        }
        // 8. Convert line breaks to HTML
        html = html.replace(/\n\n/g, '</p><p>'); // Double line breaks become paragraph breaks
        html = html.replace(/\n/g, '<br>'); // Single line breaks become <br>
        // 9. Wrap in paragraphs
        html = '<p>' + html + '</p>';
        // 10. Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p><br><\/p>/g, '<br>');
        return html;
    }

    /**
     * Render a list of attachments with metadata and actions
     */
    renderAttachmentList(attachments: any[]): string {
        // Fallback HTML escape function
        const escapeHtml = (str: string) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        const safeEscape = (window as any).SafeHTML && typeof (window as any).SafeHTML.escape === 'function'
            ? (window as any).SafeHTML.escape
            : escapeHtml;
        if (!attachments || attachments.length === 0) {
            return '<div class="no-attachments">No attachments</div>';
        }
        return `
            <div class="attachment-list">
                ${attachments.map((att, index) => {
                    const safeName = safeEscape(att.name || att.filename || 'attachment');
                    const sizeStr = att.size ? `(${(att.size/1024).toFixed(1)} KB)` : '';
                    const icon = att.contentType && att.contentType.startsWith('image/') ? '🖼️' : '📎';
                    
                    // Store attachment data in data attribute for cleaner event handling
                    const attachmentData = escapeHtml(JSON.stringify(att));
                    
                    // Actions: download, preview, open-in-cloud, delete
                    let actions = '';
                    if ((window as any).AttachmentHandler) {
                        actions += `<button class="attachment-btn download-btn" data-action="download" data-attachment-index="${index}">Download</button>`;
                        if (att.contentType && att.contentType.startsWith('image/')) {
                            actions += `<button class="attachment-btn preview-btn" data-action="preview" data-attachment-index="${index}">Preview</button>`;
                        }
                        if (att.cloudInfo) {
                            actions += `<button class="attachment-btn cloud-btn" data-action="openInCloud" data-attachment-index="${index}">Open in Cloud</button>`;
                        }
                        actions += `<button class="attachment-btn delete-btn" data-action="delete" data-attachment-index="${index}">Delete</button>`;
                    }
                    return `<div class="attachment-item" data-attachment='${attachmentData}' data-attachment-index="${index}">
                        <span class="attachment-icon">${icon}</span>
                        <span class="attachment-name">${safeName}</span>
                        <span class="attachment-size">${sizeStr}</span>
                        <span class="attachment-actions">${actions}</span>
                    </div>`;
                }).join('')}
            </div>
        `;
    }
}

export { EmailRenderer, type EmailCompatibleHtmlOptions };

// Unit test for renderAttachmentList
if (typeof window !== 'undefined') {
    (window as any).testRenderAttachmentList = () => {
        const renderer = new (EmailRenderer as any)();
        const testAttachments = [
            { name: 'photo.jpg', filename: 'photo.jpg', contentType: 'image/jpeg', size: 204800, isInline: false },
            { name: 'report.pdf', filename: 'report.pdf', contentType: 'application/pdf', size: 102400, isInline: false },
            { name: 'cloud.docx', filename: 'cloud.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 51200, isInline: false, cloudInfo: { provider: 'Drive', accountKey: 'abc', partHeaderData: 'xyz' } },
            { name: 'inline.png', filename: 'inline.png', contentType: 'image/png', size: 4096, isInline: true },
            { filename: 'unknown.bin', size: 0 }, // Edge: missing name/contentType
        ];
        const html = renderer.renderAttachmentList(testAttachments);
        console.log('Attachment list HTML:', html);
        // Optionally, inject into DOM for visual inspection
        const testDiv = document.createElement('div');
        testDiv.innerHTML = html;
        testDiv.style.border = '1px solid #ccc';
        testDiv.style.margin = '8px';
        testDiv.style.padding = '8px';
        document.body.appendChild(testDiv);
        console.log('✅ renderAttachmentList test completed');
    };
} 