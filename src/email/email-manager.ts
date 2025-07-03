/**
 * Email Manager Module
 * Handles email processing, parsing, standardization, and content generation
 * Dependencies: EMAIL_PARSING_CONFIG (loaded globally), simpleParser (mailparser)
 */

import { Email, Attachment, EmailAddress, EmailSource } from '../../types/email';

// Email parsing interfaces
interface RawEmailData {
    id?: string;
    messageId?: string;
    from?: string | EmailAddress | EmailAddressObject;
    to?: string | EmailAddress | EmailAddressObject | EmailAddress[];
    cc?: string | EmailAddress | EmailAddressObject | EmailAddress[];
    bcc?: string | EmailAddress | EmailAddressObject | EmailAddress[];
    subject?: string;
    date?: string | Date;
    html?: string;
    text?: string;
    body?: string;
    isHtml?: boolean;
    contentType?: string;
    attachments?: any[];
    headers?: Map<string, any> | Record<string, any>;
    unread?: boolean;
    priority?: string;
    inReplyTo?: string;
    references?: string[];
    labelIds?: string[];
}

interface EmailAddressObject {
    text?: string;
    value?: string;
    address?: string;
    name?: string;
}

interface GmailAPI {
    users: {
        messages: {
            get: (params: { userId: string; id: string; format: string }) => Promise<{
                data: {
                    raw?: string;
                    labelIds?: string[];
                };
            }>;
        };
    };
}

interface ParsedEmail {
    from?: EmailAddressObject;
    to?: EmailAddressObject | EmailAddressObject[];
    cc?: EmailAddressObject | EmailAddressObject[];
    bcc?: EmailAddressObject | EmailAddressObject[];
    subject?: string;
    date?: Date;
    html?: string;
    text?: string;
    attachments?: any[];
    headers?: Map<string, any>;
    priority?: string;
    inReplyTo?: string;
    references?: string[];
    messageId?: string;
}

interface EmailParsingStats {
    total: number;
    bySource: Record<string, number>;
    withHtml: number;
    withText: number;
    withAttachments: number;
    withoutContent: number;
}

interface DebugInfo {
    parseMethod: string;
    parsedAt: string;
    hasContent: boolean;
    contentLength: number;
    isHtml: boolean;
    attachmentCount: number;
}

class EmailManager {
    private config: any;
    private simpleParser: ((emailData: string) => Promise<ParsedEmail>) | undefined;

    constructor({ config, simpleParser }: { config: any, simpleParser?: (emailData: string) => Promise<ParsedEmail> }) {
        console.log('=== EmailManager CONSTRUCTOR CALLED ===');
        console.log('EmailManager config:', config);
        console.log('EmailManager simpleParser available:', !!simpleParser);
        console.log('EmailManager standardizeEmailObject function exists:', typeof this.standardizeEmailObject === 'function');
        this.config = config;
        this.simpleParser = simpleParser;
    }

    /**
     * Validate that required dependencies are available
     * @returns True if all dependencies are available
     */
    validateDependencies(): boolean {
        if (!this.config) {
            console.log('EmailManager: config not found - using default parsing');
        }
        if (!this.simpleParser) {
            console.log('EmailManager: simpleParser not available - using simplified parsing');
        }
        return true;
    }

    /**
     * Standardize email object across different sources (Gmail, IMAP, etc.)
     * @param emailData - Raw email data from any source
     * @param source - Source identifier ('gmail', 'imap', etc.)
     * @returns Standardized email object
     */
    standardizeEmailObject(emailData: RawEmailData, source: string = 'unknown'): Email {
        console.log('=== standardizeEmailObject CALLED ===', { id: emailData.id, messageId: emailData.messageId });
        // Debug: Log the raw emailData and its attachments
        console.log('[DEBUG] standardizeEmailObject input emailData:', emailData);
        console.log('[DEBUG] standardizeEmailObject input attachments:', emailData.attachments);

        // Helper function to parse email addresses
        const parseEmailAddress = (addr: any): EmailAddress => {
            if (typeof addr === 'string') {
                // Parse "Name <email@domain.com>" format
                const match = addr.match(/^(.+?)\s*<(.+?)>$/);
                if (match) {
                    return { email: match[2].trim(), name: match[1].trim() };
                }
                return { email: addr.trim() };
            } else if (typeof addr === 'object' && addr) {
                if (addr.address) {
                    return { email: addr.address, name: addr.name };
                } else if (addr.text) {
                    return parseEmailAddress(addr.text);
                } else if (addr.value) {
                    return parseEmailAddress(addr.value);
                }
            }
            return { email: String(addr || '') };
        };

        const standardEmail: Email = {
            // Core identifiers
            id: emailData.id || emailData.messageId || Date.now().toString(),
            messageId: emailData.messageId || emailData.id || Date.now().toString(),
            
            // Headers
            from: parseEmailAddress(emailData.from || ''),
            to: [],
            subject: emailData.subject || '(No Subject)',
            date: new Date().toISOString(),
            timestamp: Date.now(),
            
            // Content
            body: '',
            bodyHtml: emailData.html || '',
            bodyText: emailData.text || '',
            
            // Metadata
            attachments: this.standardizeAttachments(emailData.attachments || [], emailData.messageId || emailData.id || ''),
            headers: emailData.headers instanceof Map ? 
                Object.fromEntries(emailData.headers.entries()) : 
                (emailData.headers || {}),
            read: emailData.unread !== undefined ? !emailData.unread : false,
            hasAttachments: false,
            folder: 'INBOX',
            
            // Source tracking
            source: (source as EmailSource) || 'local',
            
            // Threading (will be set by threading manager)
            threadId: '',
            conversationId: ''
        };

        // Standardize to field
        if (emailData.to) {
            if (Array.isArray(emailData.to)) {
                standardEmail.to = emailData.to.map(parseEmailAddress);
            } else {
                standardEmail.to = [parseEmailAddress(emailData.to)];
            }
        }
        
        // Standardize cc field
        if (emailData.cc) {
            if (Array.isArray(emailData.cc)) {
                standardEmail.cc = emailData.cc.map(parseEmailAddress);
            } else {
                standardEmail.cc = [parseEmailAddress(emailData.cc)];
            }
        }
        
        // Standardize bcc field
        if (emailData.bcc) {
            if (Array.isArray(emailData.bcc)) {
                standardEmail.bcc = emailData.bcc.map(parseEmailAddress);
            } else {
                standardEmail.bcc = [parseEmailAddress(emailData.bcc)];
            }
        }
        
        // Standardize date
        if (emailData.date) {
            try {
                const dateObj = new Date(emailData.date);
                if (!isNaN(dateObj.getTime())) {
                    standardEmail.date = dateObj.toISOString();
                    standardEmail.timestamp = dateObj.getTime();
                } else {
                    standardEmail.date = new Date().toISOString();
                    standardEmail.timestamp = Date.now();
                }
            } catch (error) {
                console.warn('Invalid date format:', emailData.date);
                standardEmail.date = new Date().toISOString();
                standardEmail.timestamp = Date.now();
            }
        } else {
            standardEmail.date = new Date().toISOString();
            standardEmail.timestamp = Date.now();
        }
        
        // Determine content and body
        if (standardEmail.bodyHtml && standardEmail.bodyHtml.trim()) {
            standardEmail.body = standardEmail.bodyHtml;
        } else if (standardEmail.bodyText && standardEmail.bodyText.trim()) {
            standardEmail.body = standardEmail.bodyText;
        } else if (emailData.body) {
            standardEmail.body = emailData.body;
            if (emailData.isHtml) {
                standardEmail.bodyHtml = emailData.body;
            } else {
                standardEmail.bodyText = emailData.body;
            }
        } else {
            standardEmail.body = '[No content available]';
            standardEmail.bodyText = '[No content available]';
        }
        
        // Ensure we have text content for search/preview
        if (!standardEmail.bodyText && standardEmail.bodyHtml) {
            // Create text version from HTML for search/preview
            standardEmail.bodyText = standardEmail.bodyHtml
                .replace(/<style[^>]*>.*?<\/style>/gis, '')
                .replace(/<script[^>]*>.*?<\/script>/gis, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim();
        }

        // Set hasAttachments flag
        standardEmail.hasAttachments = !!(standardEmail.attachments && standardEmail.attachments.length > 0);
        
        // IMPORTANT: Set html/text properties for renderer compatibility
        // The renderer expects email.html and email.text, but we store in bodyHtml/bodyText
        (standardEmail as any).html = standardEmail.bodyHtml;
        (standardEmail as any).text = standardEmail.bodyText;
        
        // Debug: Log the standardized email and its attachments
        console.log('[DEBUG] standardizeEmailObject output:', standardEmail);
        console.log('[DEBUG] standardizeEmailObject output attachments:', standardEmail.attachments);
        
        // Warn if table tags are present in input but missing in output
        if (emailData.html && /<(table|tr|td|th|tbody|thead|tfoot)[\s>]/i.test(emailData.html) &&
            (!standardEmail.bodyHtml || !/<(table|tr|td|th|tbody|thead|tfoot)[\s>]/i.test(standardEmail.bodyHtml))) {
            console.warn('[WARNING] Table tags present in input html but missing in output bodyHtml!', {
                id: standardEmail.id,
                inputHtml: emailData.html.substring(0, 500),
                outputBodyHtml: standardEmail.bodyHtml?.substring(0, 500)
            });
        }
        
        // Debug: Confirm function definition
        console.log('=== standardizeEmailObject FUNCTION DEFINED ===');
        
        return standardEmail;
    }

    /**
     * Enhance email with accurate attachment information using hybrid detection
     * Falls back to raw RFC822 parsing if Gmail JSON API returns empty attachments
     * @param email - Email object to enhance
     * @param source - Email source ('gmail', 'imap', etc.)
     * @returns Enhanced email with accurate attachments
     */
    async enhanceEmailAttachments(email: Email, source: string = 'gmail'): Promise<Email> {
        // Only enhance Gmail emails that appear to have no attachments
        if (source !== 'gmail' || !email.messageId || (email.attachments && email.attachments.length > 0)) {
            return email;
        }

        try {
            console.log(`[ATTACHMENT ENHANCEMENT] Checking email ${email.messageId} for missing attachments`);
            
            // Use IPC to fetch raw message and parse attachments
            const ipcRenderer = (window as any).require('electron').ipcRenderer;
            const googleAuth = (window as any).googleAuth;
            
            if (!googleAuth) {
                console.warn('[ATTACHMENT ENHANCEMENT] No Google auth token available');
                return email;
            }

            // Fetch raw Gmail message
            const rawResult = await ipcRenderer.invoke('fetch-gmail-raw-message', { 
                messageId: email.messageId, 
                auth: googleAuth 
            });
            
            if (!rawResult.success || !rawResult.raw) {
                console.warn(`[ATTACHMENT ENHANCEMENT] Failed to fetch raw message: ${rawResult.error}`);
                return email;
            }

            // Parse raw message for attachments
            const parseResult = await ipcRenderer.invoke('parse-raw-email', rawResult.raw);
            
            if (!parseResult.success || !parseResult.parsed.attachments) {
                console.warn(`[ATTACHMENT ENHANCEMENT] Failed to parse raw message: ${parseResult.error}`);
                return email;
            }

            const rawAttachments = parseResult.parsed.attachments;
            
            if (rawAttachments.length > 0) {
                console.log(`[ATTACHMENT ENHANCEMENT] Found ${rawAttachments.length} attachments in raw message that were missing from Gmail JSON`);
                
                // Convert raw attachments to standardized format
                const standardizedAttachments = this.standardizeAttachments(rawAttachments, email.messageId);
                
                // Update email with enhanced attachment information
                const enhancedEmail = {
                    ...email,
                    attachments: standardizedAttachments,
                    hasAttachments: standardizedAttachments.length > 0
                };
                
                console.log(`[ATTACHMENT ENHANCEMENT] Enhanced email ${email.messageId} with ${standardizedAttachments.length} attachments`);
                return enhancedEmail;
            } else {
                console.log(`[ATTACHMENT ENHANCEMENT] No attachments found in raw message for ${email.messageId}`);
                return email;
            }
            
        } catch (error) {
            console.error(`[ATTACHMENT ENHANCEMENT] Error enhancing email ${email.messageId}:`, error);
            return email;
        }
    }

    /**
     * Standardize attachment data across different email sources
     * @param attachments - Array of attachment objects
     * @param messageId - Optional message ID for Gmail attachments
     * @returns Standardized attachment objects
     */
    standardizeAttachments(attachments: any[], messageId?: string): Attachment[] {
        if (!Array.isArray(attachments)) {
            return [];
        }

        return attachments.map((attachment: any, index: number): Attachment => {
            const name = attachment.filename || attachment.name || `attachment_${index + 1}`;
            const att: Attachment = {
                name,
                filename: name,
                url: attachment.url || attachment.path || '',
                contentType: attachment.contentType || attachment.mimeType || 'application/octet-stream',
                contentTypeParam: attachment.contentTypeParam || undefined,
                size: attachment.size || attachment.length || 0,
                isInline: !!(attachment.contentDisposition && attachment.contentDisposition.toLowerCase().includes('inline')) || !!attachment.cid,
                isTemporary: !!attachment.isTemporary,
                cloudInfo: attachment.cloudInfo || (attachment.sendViaCloud ? {
                    provider: attachment.cloudProvider || '',
                    accountKey: attachment.cloudFileAccountKey || '',
                    partHeaderData: attachment.cloudPartHeaderData || ''
                } : undefined),
                contentId: attachment.contentId || attachment.cid || undefined,
                charset: attachment.charset || undefined,
                macType: attachment.macType || undefined,
                macCreator: attachment.macCreator || undefined,
                description: attachment.description || undefined,
                disposition: attachment.contentDisposition || undefined,
                msgUri: attachment.msgUri || undefined,
                urlCharset: attachment.urlCharset || undefined,
                content: attachment.content,
                encoding: attachment.encoding || undefined,
                attachmentId: attachment.attachmentId || undefined,
                messageId: messageId || attachment.messageId || undefined
            };
            return att;
        });
    }

    /**
     * Parse Gmail raw message using mailparser
     * @param gmail - Gmail API client
     * @param messageId - Gmail message ID
     * @returns Parsed email object or null if failed
     */
    async parseGmailRawMessage(gmail: GmailAPI, messageId: string): Promise<Email | null> {
        try {
            // Get raw email format from Gmail API
            const rawResponse = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'raw'
            });
            
            if (rawResponse.data.raw) {
                // Decode base64url encoded raw message
                const rawEmail = Buffer.from(rawResponse.data.raw, 'base64url').toString('utf-8');
                
                // Parse with mailparser
                const parsed = await this.simpleParser!(rawEmail);
                
                console.log(`Parsed Gmail email ${messageId} with mailparser:`, {
                    subject: parsed.subject,
                    from: parsed.from?.text || parsed.from?.value,
                    hasHtml: !!parsed.html,
                    hasText: !!parsed.text,
                    attachmentCount: parsed.attachments?.length || 0
                });
                
                return this.standardizeEmailObject({
                    id: messageId,
                    messageId: messageId,
                    from: parsed.from ? this.convertEmailAddressObject(parsed.from) : undefined,
                    to: this.convertEmailAddressObjects(parsed.to),
                    cc: this.convertEmailAddressObjects(parsed.cc),
                    bcc: this.convertEmailAddressObjects(parsed.bcc),
                    subject: parsed.subject,
                    date: parsed.date,
                    html: parsed.html,
                    text: parsed.text,
                    attachments: parsed.attachments,
                    headers: parsed.headers,
                    priority: parsed.priority,
                    inReplyTo: parsed.inReplyTo,
                    references: parsed.references,
                    unread: rawResponse.data.labelIds?.includes('UNREAD') || false
                }, 'gmail-api');
            }
        } catch (error) {
            console.warn(`Failed to parse Gmail message ${messageId} with mailparser:`, error);
        }
        
        return null;
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
        if (email.bodyText && email.bodyText.trim()) {
            preview = email.bodyText.trim();
        } else if (email.bodyHtml && email.bodyHtml.trim()) {
            preview = email.bodyHtml
                .replace(/<style[^>]*>.*?<\/style>/gis, '')
                .replace(/<script[^>]*>.*?<\/script>/gis, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim();
        } else if (email.body && email.body.trim()) {
            preview = email.body
                .replace(/<style[^>]*>.*?<\/style>/gis, '')
                .replace(/<script[^>]*>.*?<\/script>/gis, '')
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
     * Add debug information to email objects
     * @param email - Email object
     * @param parseMethod - Parsing method used
     * @returns Email object with debug info
     */
    addDebugInfo(email: Email, parseMethod: string): Email {
        if (this.config && this.config.debugParsing) {
            (email as any)._debug = {
                parseMethod: parseMethod,
                parsedAt: new Date().toISOString(),
                hasContent: !!(email.body || email.bodyText || email.bodyHtml),
                contentLength: (email.body || email.bodyText || '').length,
                isHtml: email.bodyHtml ? true : false,
                attachmentCount: email.attachments?.length || 0
            } as DebugInfo;
        }
        return email;
    }

    /**
     * Log email parsing statistics for debugging
     * @param emails - Array of email objects
     */
    logEmailParsingStats(emails: Email[]): void {
        if (!this.config || !this.config.debugParsing) return;
        
        console.log('=== EMAIL PARSING STATISTICS ===');
        
        const stats: EmailParsingStats = {
            total: emails.length,
            bySource: {},
            withHtml: 0,
            withText: 0,
            withAttachments: 0,
            withoutContent: 0
        };
        
        emails.forEach(email => {
            // Count by source
            const source = email.source || 'unknown';
            stats.bySource[source] = (stats.bySource[source] || 0) + 1;
            
            // Count content types
            if (email.bodyHtml && email.bodyHtml.trim()) stats.withHtml++;
            if (email.bodyText && email.bodyText.trim()) stats.withText++;
            if (email.attachments && email.attachments.length > 0) stats.withAttachments++;
            if (!email.body || email.body.trim() === '' || email.body === '[No content available]') {
                stats.withoutContent++;
            }
        });
        
        console.log('Parsing Statistics:', stats);
        console.log('=== END PARSING STATISTICS ===');
    }

    /**
     * Create a test email for debugging mailparser functionality
     * @returns Raw email message
     */
    createTestEmail(): string {
        const testEmailRaw = `From: Test Sender <test@example.com>
To: Test Recipient <recipient@example.com>
Subject: Test Email for Mailparser
Date: ${new Date().toUTCString()}
Message-ID: <test-${Date.now()}@example.com>
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=UTF-8

This is a test email to verify mailparser functionality.
It contains both plain text and HTML content.

Best regards,
Test Sender

--boundary123
Content-Type: text/html; charset=UTF-8

<html>
<body>
<h1>Test Email</h1>
<p>This is a <strong>test email</strong> to verify mailparser functionality.</p>
<p>It contains both plain text and <em>HTML content</em>.</p>
<p>Best regards,<br>Test Sender</p>
</body>
</html>

--boundary123--`;

        return testEmailRaw;
    }

    /**
     * Test mailparser functionality with comprehensive tests
     * @returns True if mailparser is working correctly
     */
    async testMailparserFunctionality(): Promise<boolean> {
        console.log('=== COMPREHENSIVE MAILPARSER TEST ===');
        
        try {
            // Test 1: Simple plain text email
            const simpleEmail = `From: simple@example.com
To: recipient@example.com
Subject: Simple Test
Date: ${new Date().toUTCString()}

Simple test email content.`;

            const parsed1 = await this.simpleParser!(simpleEmail);
            console.log('✅ Simple email test passed:', {
                from: parsed1.from?.text || parsed1.from?.value,
                subject: parsed1.subject,
                hasText: !!parsed1.text
            });

            // Test 2: Multipart email with HTML
            const multipartEmail = this.createTestEmail();
            const parsed2 = await this.simpleParser!(multipartEmail);
            console.log('✅ Multipart email test passed:', {
                from: parsed2.from?.text || parsed2.from?.value,
                subject: parsed2.subject,
                hasText: !!parsed2.text,
                hasHtml: !!parsed2.html,
                messageId: parsed2.messageId
            });

            // Test 3: Email with attachments (simulated)
            const emailWithAttachment = `From: sender@example.com
To: recipient@example.com
Subject: Email with Attachment
Date: ${new Date().toUTCString()}
Content-Type: multipart/mixed; boundary="mixed123"

--mixed123
Content-Type: text/plain

Email with attachment content.

--mixed123
Content-Type: application/pdf; name="document.pdf"
Content-Disposition: attachment; filename="document.pdf"

[Binary content would be here]

--mixed123--`;

            const parsed3 = await this.simpleParser!(emailWithAttachment);
            console.log('✅ Attachment email test passed:', {
                subject: parsed3.subject,
                attachmentCount: parsed3.attachments?.length || 0
            });

            console.log('🎉 All mailparser tests passed successfully!');
            return true;

        } catch (error) {
            console.error('❌ Mailparser test failed:', error);
            console.error('Error details:', (error as Error).message);
            return false;
        }
    }

    /**
     * Convert EmailAddressObject to EmailAddress
     * @param addr - EmailAddressObject from mailparser
     * @returns EmailAddress object
     */
    convertEmailAddressObject(addr: EmailAddressObject): EmailAddress {
        return {
            email: addr.address || addr.value || addr.text || '',
            name: addr.name || ''
        };
    }

    /**
     * Convert EmailAddressObject array to EmailAddress array
     * @param addrs - EmailAddressObject array from mailparser
     * @returns EmailAddress array
     */
    convertEmailAddressObjects(addrs: EmailAddressObject | EmailAddressObject[] | undefined): EmailAddress[] {
        if (!addrs) return [];
        if (Array.isArray(addrs)) {
            return addrs.map(addr => this.convertEmailAddressObject(addr));
        }
        return [this.convertEmailAddressObject(addrs)];
    }
}

console.log('=== EmailManager CLASS DEFINED ===');
console.log('EmailManager class methods:', Object.getOwnPropertyNames(EmailManager.prototype));

export { EmailManager, type RawEmailData, type EmailAddressObject, type GmailAPI, type ParsedEmail, type EmailParsingStats, type DebugInfo };

// Unit test for standardizeAttachments
if (typeof window !== 'undefined') {
    (window as any).testStandardizeAttachments = () => {
        const emailManager = new (EmailManager as any)({});
        const testInput = [
            {
                filename: 'test.pdf',
                url: 'https://example.com/test.pdf',
                contentType: 'application/pdf',
                size: 12345,
                contentDisposition: 'attachment',
                isTemporary: false
            },
            {
                name: 'inline-image.png',
                path: '/tmp/inline-image.png',
                mimeType: 'image/png',
                size: 54321,
                contentDisposition: 'inline',
                cid: 'imagecid',
                isTemporary: true
            },
            {
                filename: 'cloud.docx',
                url: 'https://cloud.com/file.docx',
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: 9999,
                sendViaCloud: true,
                cloudProvider: 'dropbox',
                cloudFileAccountKey: 'acc123',
                cloudPartHeaderData: 'headerdata'
            }
        ];
        const result = emailManager.standardizeAttachments(testInput);
        console.assert(result.length === 3, 'Should return 3 attachments');
        console.assert(result[0].name === 'test.pdf', 'First attachment name');
        console.assert(result[0].filename === 'test.pdf', 'First attachment filename');
        console.assert(result[1].isInline === true, 'Second attachment is inline');
        console.assert(result[2].cloudInfo?.provider === 'dropbox', 'Third attachment cloud provider');
        console.log('✅ testStandardizeAttachments passed', result);
        return result;
    };

    // Unit test for edge cases in attachment standardization
    (window as any).testStandardizeAttachmentsEdgeCases = () => {
        const emailManager = new (EmailManager as any)({});
        const testInput = [
            // Hidden attachment
            { filename: 'hidden.txt', size: 100, contentDisposition: 'hidden' },
            // Large attachment
            { filename: 'large.zip', size: 100000000, contentDisposition: 'attachment' },
            // Corrupted attachment (missing fields)
            { size: 0 },
            // Charset issue
            { filename: 'utf8.txt', size: 10, contentDisposition: 'attachment', charset: 'utf-8' },
        ];
        const result = emailManager.standardizeAttachments(testInput);
        if (
            result.length === 4 &&
            result[0].filename === 'hidden.txt' &&
            result[1].filename === 'large.zip' &&
            result[2].filename === 'attachment_3' &&
            result[3].filename === 'utf8.txt'
        ) {
            console.log('✅ Edge case attachment standardization test passed');
        } else {
            console.error('❌ Edge case attachment standardization test failed', result);
        }
    };

    (window as any).EmailManager = EmailManager;
} 