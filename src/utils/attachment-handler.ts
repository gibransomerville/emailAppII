/**
 * Attachment Handler Module
 * Handles attachment preview, download, and file type management
 * 
 * Dependencies:
 * - SafeHTML (secure HTML rendering)
 * - showNotification (notifications)
 * - AttachmentManager (lazy loading for Gmail attachments)
 * 
 * @author Email App Modular Architecture
 * @version 1.0.0
 */

import { Attachment } from '../../types/email.js';

// File type categories
type FileTypeCategory = 'image' | 'text' | 'pdf' | 'video' | 'audio' | 'document' | 'archive' | 'unknown';

interface AttachmentValidationResult {
    isValid: boolean;
    missing: string[];
}

/**
 * Singleton manager for Gmail attachment operations
 */
class AttachmentManagerSingleton {
    private static instance: AttachmentManagerSingleton;
    private cache: Map<string, string> = new Map();
    
    private constructor() {
        // Private constructor to enforce singleton pattern
    }
    
    static getInstance(): AttachmentManagerSingleton {
        if (!AttachmentManagerSingleton.instance) {
            AttachmentManagerSingleton.instance = new AttachmentManagerSingleton();
        }
        return AttachmentManagerSingleton.instance;
    }
    
    /**
     * Fetch Gmail attachment content lazily
     */
    async fetchGmailAttachmentContent(attachment: Attachment): Promise<string> {
        if (!attachment.attachmentId || !attachment.messageId) {
            throw new Error('Gmail attachment ID and message ID are required');
        }
        
        const cacheKey = `${attachment.messageId}-${attachment.attachmentId}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }
        
        try {
            // Always request Google auth token from main process
            const ipcRenderer = (window as any).require('electron').ipcRenderer;
            const googleAuth = await ipcRenderer.invoke('get-google-auth');
            if (!googleAuth) {
                console.warn('Google authentication not available for Gmail attachment');
                throw new Error('Google authentication is required to download Gmail attachments. Please sign in to your Google account first.');
            }
            
            // Use IPC to fetch attachment content
            const result = await ipcRenderer.invoke('fetch-gmail-attachment', {
                messageId: attachment.messageId,
                attachmentId: attachment.attachmentId,
                auth: googleAuth
            });
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch attachment content');
            }
            
            // Convert base64url to base64 format
            // Gmail API returns base64url, but attachment processor expects regular base64
            let base64Content = result.data;
            if (base64Content && typeof base64Content === 'string') {
                // Convert base64url to base64: replace - with +, _ with /
                base64Content = base64Content.replace(/-/g, '+').replace(/_/g, '/');
                
                // Add padding if necessary
                const padding = '='.repeat((4 - base64Content.length % 4) % 4);
                base64Content = base64Content + padding;
                
                console.log(`[Gmail Attachment] Converted base64url to base64 for ${attachment.filename}`, {
                    originalLength: result.data.length,
                    convertedLength: base64Content.length,
                    addedPadding: padding.length
                });
            }
            
            // Cache the converted content
            this.cache.set(cacheKey, base64Content);
            return base64Content;
            
        } catch (error) {
            console.error('Error fetching Gmail attachment content:', error);
            throw error;
        }
    }
    
    /**
     * Download attachment with loading indicator
     */
    async downloadAttachmentWithLoading(attachment: Attachment): Promise<void> {
        try {
            // Show loading notification
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Downloading attachment...', 'info');
            }
            
            // Get content for Gmail attachments
            if (attachment.attachmentId && !attachment.content) {
                try {
                    attachment.content = await this.fetchGmailAttachmentContent(attachment);
                } catch (error) {
                    console.error('Error fetching Gmail attachment content:', error);
                    throw error;
                }
            }
            
            // Use regular download handler
            await AttachmentHandler.downloadAttachment(attachment);
            
        } catch (error) {
            console.error('Error downloading attachment:', error);
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Failed to download attachment: ' + (error as Error).message, 'error');
            }
            throw error;
        }
    }
    
    /**
     * Preview attachment with loading indicator
     */
    async previewAttachmentWithLoading(attachment: Attachment): Promise<void> {
        try {
            // Show loading notification
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Loading attachment preview...', 'info');
            }
            
            // Get content for Gmail attachments
            if (attachment.attachmentId && !attachment.content) {
                try {
                    attachment.content = await this.fetchGmailAttachmentContent(attachment);
                } catch (error) {
                    console.error('Error fetching Gmail attachment content:', error);
                    throw error;
                }
            }
            
            // Use regular preview handler
            await AttachmentHandler.previewAttachment(attachment);
            
        } catch (error) {
            console.error('Error previewing attachment:', error);
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Failed to preview attachment: ' + (error as Error).message, 'error');
            }
            throw error;
        }
    }
}

// Export the singleton instance getter
export const getAttachmentManager = AttachmentManagerSingleton.getInstance;

/**
 * Attachment Handler Class
 */
class AttachmentHandler {
    /**
     * File type categories to open with native OS viewer
     */
    static readonly NATIVE_PREVIEW_TYPES: FileTypeCategory[] = ['pdf', 'document', 'archive', 'video', 'audio'];

    /**
     * Supported file types for preview
     */
    static readonly PREVIEWABLE_TYPES: Record<FileTypeCategory, string[]> = {
        image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        text: ['text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml'],
        pdf: ['application/pdf'],
        video: ['video/mp4', 'video/webm', 'video/ogg'],
        audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
        document: [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ],
        archive: [
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/gzip',
            'application/x-tar'
        ],
        unknown: []
    };

    /**
     * Get file type category from MIME type
     */
    static getFileTypeCategory(mimeType: string): FileTypeCategory {
        if (!mimeType) return 'unknown';
        
        for (const [category, types] of Object.entries(this.PREVIEWABLE_TYPES)) {
            if (types.includes(mimeType.toLowerCase())) {
                return category as FileTypeCategory;
            }
        }
        return 'unknown';
    }

    /**
     * Get appropriate icon for file type
     */
    static getFileIcon(mimeType: string, filename?: string): string {
        const category = this.getFileTypeCategory(mimeType);
        
        switch (category) {
            case 'image':
                return 'fas fa-image';
            case 'text':
                return 'fas fa-file-alt';
            case 'pdf':
                return 'fas fa-file-pdf';
            case 'video':
                return 'fas fa-file-video';
            case 'audio':
                return 'fas fa-file-audio';
            case 'document':
                return 'fas fa-file-word';
            case 'archive':
                return 'fas fa-file-archive';
            default:
                // Try to determine from filename extension
                if (filename) {
                    const ext = filename.toLowerCase().split('.').pop();
                    switch (ext) {
                        case 'doc':
                        case 'docx':
                            return 'fas fa-file-word';
                        case 'xls':
                        case 'xlsx':
                            return 'fas fa-file-excel';
                        case 'ppt':
                        case 'pptx':
                            return 'fas fa-file-powerpoint';
                        case 'zip':
                        case 'rar':
                        case '7z':
                            return 'fas fa-file-archive';
                        default:
                            return 'fas fa-file';
                    }
                }
                return 'fas fa-file';
        }
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes: number): string {
        if (!bytes || bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
        
        return `${size} ${sizes[i]}`;
    }

    /**
     * Decode base64 attachment data
     */
    static decodeAttachmentData(encodedData: string, encoding: string = 'base64'): string {
        try {
            if (encoding === 'base64') {
                return atob(encodedData);
            } else if (encoding === 'base64url') {
                // Convert base64url to base64
                const base64 = encodedData.replace(/-/g, '+').replace(/_/g, '/');
                const padding = '='.repeat((4 - base64.length % 4) % 4);
                return atob(base64 + padding);
            }
            return encodedData;
        } catch (error) {
            console.error('Error decoding attachment data:', error);
            throw new Error('Failed to decode attachment data');
        }
    }

    /**
     * Create data URL for attachment using safe data processor
     */
    static async createDataURL(attachment: Attachment): Promise<string> {
        try {
            // Check if we need to fetch content lazily for Gmail attachments
            if (!attachment.content && attachment.attachmentId && attachment.messageId) {
                try {
                    // Get Google auth token
                    const ipcRenderer = (window as any).require('electron').ipcRenderer;
                    const googleAuth = await ipcRenderer.invoke('get-google-auth');
                    if (!googleAuth) {
                        throw new Error('Please sign in to your Google account to preview attachments.');
                    }
                    
                    // Fetch attachment content using IPC
                    const result = await ipcRenderer.invoke('fetch-gmail-attachment', {
                        messageId: attachment.messageId,
                        attachmentId: attachment.attachmentId,
                        auth: googleAuth
                    });
                    
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to fetch attachment content');
                    }
                    
                    // Convert base64url to base64 format
                    // Gmail API returns base64url, but attachment processor expects regular base64
                    let base64Content = result.data;
                    if (base64Content && typeof base64Content === 'string') {
                        // Convert base64url to base64: replace - with +, _ with /
                        base64Content = base64Content.replace(/-/g, '+').replace(/_/g, '/');
                        
                        // Add padding if necessary
                        const padding = '='.repeat((4 - base64Content.length % 4) % 4);
                        base64Content = base64Content + padding;
                        
                        console.log(`[Gmail Attachment] Converted base64url to base64 for ${attachment.filename}`, {
                            originalLength: result.data.length,
                            convertedLength: base64Content.length,
                            addedPadding: padding.length
                        });
                    }
                    
                    attachment.content = base64Content;
                } catch (authError) {
                    // If Google authentication is not available, check if we can handle this attachment another way
                    console.warn('Failed to fetch Gmail attachment content:', authError);
                    
                    // If the attachment has a URL, try to use that instead
                    if (attachment.url && attachment.url.startsWith('http')) {
                        console.log('Attempting to use attachment URL as fallback');
                        try {
                            const response = await fetch(attachment.url);
                            if (response.ok) {
                                const blob = await response.blob();
                                const arrayBuffer = await blob.arrayBuffer();
                                const bytes = new Uint8Array(arrayBuffer);
                                const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
                                attachment.content = base64;
                            } else {
                                throw new Error(`Failed to fetch attachment from URL: ${response.status}`);
                            }
                        } catch (fetchError) {
                            console.error('Failed to fetch attachment from URL:', fetchError);
                            throw authError; // Re-throw the original authentication error
                        }
                    } else {
                        // No alternative way to get content, re-throw the authentication error
                        throw authError;
                    }
                }
            }
            
            if (!attachment.content) {
                throw new Error('No attachment content available. The attachment may require authentication to download.');
            }

            // Use safe data processor to create data URL
            const { default: AttachmentDataProcessor } = await import('./attachment-data-processor.js');
            
            // Debug attachment data format
            AttachmentDataProcessor.debugAttachmentData(attachment);
            
            // Validate attachment before processing
            const validation = AttachmentDataProcessor.validateAttachment(attachment);
            if (!validation.isValid) {
                console.warn('Attachment validation failed:', validation.errors);
                // Continue anyway, but log the issues
            }
            
            return await AttachmentDataProcessor.createSafeDataURL(attachment);
            
        } catch (error) {
            console.error('Error creating data URL for attachment:', error);
            throw error;
        }
    }

    /**
     * Debug logger for attachment handling
     */
    static debugLog = (area: string, message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        const prefix = `[Attachment Debug ${timestamp}]`;
        
        // Helper function to safely stringify circular references
        const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key: string, value: any) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[Circular Reference]';
                    }
                    seen.add(value);
                }
                if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
                    return `Binary data (${value.byteLength} bytes)`;
                }
                if (value instanceof Buffer) {
                    return `Buffer (${value.length} bytes)`;
                }
                if (key === 'content') {
                    return value ? `Content present (${typeof value})` : 'No content';
                }
                if (key === 'buttonElement') {
                    return '[HTML Element]';
                }
                return value;
            };
        };

        // Format data for better readability and add correlation context
        const contextData = data ? {
            ...data,
            correlationContext: {
                timestamp,
                messageId: data.messageId || data.emailContext?.messageId || data.attachment?.messageId || 'unknown',
                attachmentId: data.attachmentId || data.attachment?.attachmentId || 'unknown',
                contentId: data.contentId || data.attachment?.contentId || 'unknown',
                processingArea: area,
                processingStage: message
            }
        } : null;

        console.group(`${prefix} [${area}]`);
        console.log(`${message} (${timestamp})`);
        
        if (contextData) {
            try {
                // Log each top-level property separately for better visibility
                Object.entries(contextData).forEach(([key, value]) => {
                    if (key === 'correlationContext') {
                        console.log('Correlation:', value);
                    } else {
                        console.log(`${key}:`, JSON.stringify(value, getCircularReplacer(), 2));
                    }
                });
            } catch (error) {
                console.log('Error formatting debug data:', error);
                console.log('Raw data:', data);
            }
        }
        
        console.groupEnd();
    };

    /**
     * Create attachment preview element (ultra-minimal for PDFs)
     */
    static async createAttachmentPreview(attachment: Attachment): Promise<HTMLElement> {
        this.debugLog('Preview Creation', 'Creating preview content', {
            type: attachment.contentType,
            size: this.formatFileSize(attachment.size)
        });
        
        try {
            const fileType = this.getFileTypeCategory(attachment.contentType);
            
            switch (fileType) {
                case 'image':
                    this.debugLog('Image Preview', 'Creating image preview');
                    const imgUrl = await this.createDataURL(attachment);
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.style.cssText = `
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                        border-radius: 4px;
                        margin: 0;
                        padding: 0;
                    `;
                    img.alt = attachment.filename || 'Image preview';
                    return img; // Return image directly

                case 'text':
                    this.debugLog('Text Preview', 'Creating text preview');
                    const pre = document.createElement('pre');
                    pre.style.cssText = `
                        width: 100%;
                        height: 100%;
                        overflow: auto;
                        margin: 0;
                        padding: 16px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-family: monospace;
                        white-space: pre-wrap;
                        word-break: break-word;
                        box-sizing: border-box;
                    `;
                    
                    let content = '';
                    if (attachment.content) {
                        if (typeof attachment.content === 'string') {
                            content = attachment.content;
                        } else if (Buffer.isBuffer(attachment.content)) {
                            content = attachment.content.toString(attachment.encoding as BufferEncoding || 'utf8');
                        }
                    }
                    pre.textContent = content || 'No content available';
                    return pre; // Return pre element directly

                default:
                    this.debugLog('No Preview', 'No preview available for this file type');
                    const noPreview = document.createElement('div');
                    noPreview.style.cssText = `
                        text-align: center;
                        padding: 40px;
                        color: #666;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        margin: 0;
                    `;
                    noPreview.innerHTML = `
                        <i class="${this.getFileIcon(attachment.contentType, attachment.filename)}" 
                           style="font-size: 48px; color: #666; margin-bottom: 16px;"></i>
                        <p style="margin: 0;">Preview not available for this file type</p>
                        <p style="margin: 8px 0 0 0; color: #999; font-size: 14px;">${attachment.contentType}</p>
                    `;
                    return noPreview; // Return element directly
            }

        } catch (error) {
            this.debugLog('Preview Creation', 'Error creating preview content', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack
                } : 'Unknown error'
            });

            const errorDisplay = document.createElement('div');
            errorDisplay.style.cssText = `
                text-align: center;
                padding: 40px;
                color: #d32f2f;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                margin: 0;
            `;
            errorDisplay.innerHTML = `
                <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <h3 style="margin: 0 0 12px 0;">Preview Error</h3>
                <p style="margin: 0; color: #666;">${(error as Error).message}</p>
            `;
            return errorDisplay;
        }
    }

    /**
     * Create attachment list for email
     */
    static createAttachmentList(attachments: Attachment[]): HTMLElement | null {
        this.debugLog('Attachment List', 'Creating attachment list', {
            count: attachments?.length || 0,
            types: attachments?.map(a => a.contentType),
            sizes: attachments?.map(a => this.formatFileSize(a.size)),
            emailContext: {
                messageId: attachments?.[0]?.messageId,
                hasGmailAttachments: attachments?.some(a => !!a.attachmentId)
            }
        });

        if (!attachments || attachments.length === 0) {
            return null;
        }

        const attachmentContainer = document.createElement('div');
        attachmentContainer.className = 'email-attachments';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'attachments-header';
        header.style.cssText = 'margin: 16px 0 8px 0; padding: 8px 0; border-top: 1px solid #e0e0e0;';
        
        const h4 = document.createElement('h4');
        h4.style.cssText = 'margin: 0; font-size: 14px; color: #5f6368; display: flex; align-items: center;';
        
        const paperclip = document.createElement('i');
        paperclip.className = 'fas fa-paperclip';
        paperclip.style.marginRight = '8px';
        
        h4.appendChild(paperclip);
        h4.appendChild(document.createTextNode(`${attachments.length} Attachment${attachments.length > 1 ? 's' : ''}`));
        header.appendChild(h4);
        
        // Create attachments list
        const attachmentsList = document.createElement('div');
        attachmentsList.className = 'attachments-list';
        
        // Create each attachment item
        attachments.forEach((attachment, index) => {
            const filename = attachment.filename || `attachment_${index + 1}`;
            const fileIcon = this.getFileIcon(attachment.contentType, filename);
            const fileSize = this.formatFileSize(attachment.size);
            
            // Create attachment data
            const attachmentData = {
                name: attachment.filename || filename,
                type: attachment.contentType,
                size: attachment.size,
                messageId: attachment.messageId,
                attachmentId: attachment.attachmentId,
                isInline: attachment.isInline,
                hasContent: !!attachment.content
            };
            
            // Create main button
            const attachmentButton = document.createElement('button');
            attachmentButton.className = 'gmail-attachment-item';
            attachmentButton.setAttribute('data-attachment', JSON.stringify(attachmentData));
            attachmentButton.setAttribute('data-attachment-index', String(index));
            attachmentButton.setAttribute('title', `Click to preview ${filename}`);
            attachmentButton.type = 'button';
            
            // Create name section
            const nameDiv = document.createElement('div');
            nameDiv.className = 'attachment-name';
            
            const icon = document.createElement('i');
            icon.className = fileIcon;
            icon.style.marginRight = '8px';
            
            const nameText = document.createTextNode(filename);
            
            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'file-size';
            sizeSpan.textContent = `(${fileSize})`;
            
            nameDiv.appendChild(icon);
            nameDiv.appendChild(nameText);
            nameDiv.appendChild(sizeSpan);
            
            // Create actions section
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'attachment-actions';
            
            // Preview button
            const previewBtn = document.createElement('button');
            previewBtn.className = 'attachment-btn preview-btn';
            previewBtn.setAttribute('data-action', 'preview');
            previewBtn.setAttribute('data-attachment-index', String(index));
            previewBtn.setAttribute('title', `Preview ${filename}`);
            previewBtn.type = 'button';
            
            const previewIcon = document.createElement('i');
            previewIcon.className = 'fas fa-eye';
            previewBtn.appendChild(previewIcon);
            
            // Download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'attachment-btn download-btn';
            downloadBtn.setAttribute('data-action', 'download');
            downloadBtn.setAttribute('data-attachment-index', String(index));
            downloadBtn.setAttribute('title', `Download ${filename}`);
            downloadBtn.type = 'button';
            
            const downloadIcon = document.createElement('i');
            downloadIcon.className = 'fas fa-download';
            downloadBtn.appendChild(downloadIcon);
            
            actionsDiv.appendChild(previewBtn);
            actionsDiv.appendChild(downloadBtn);
            
            // Assemble attachment item
            attachmentButton.appendChild(nameDiv);
            attachmentButton.appendChild(actionsDiv);
            attachmentsList.appendChild(attachmentButton);
        });
        
        attachmentContainer.appendChild(header);
        attachmentContainer.appendChild(attachmentsList);
        
        // Add event listeners for attachment actions
        this.addAttachmentEventListeners(attachmentContainer, attachments);
        
        return attachmentContainer;
    }

    /**
     * Add event listeners for attachment actions
     */
    static addAttachmentEventListeners(container: HTMLElement, attachments: Attachment[]): void {
        this.debugLog('Event Listeners', 'Adding attachment event listeners', {
            containerClass: container.className,
            attachmentCount: attachments.length,
            types: attachments.map(a => a.contentType)
        });

        // Helper function to get attachment data
        const getAttachmentFromElement = (element: HTMLElement): Attachment | null => {
            const attachmentItem = element.closest('.gmail-attachment-item') as HTMLElement;
            if (!attachmentItem) return null;
            
            try {
                const attachmentData = attachmentItem.dataset.attachment;
                if (!attachmentData) return null;
                
                this.debugLog('Data Parse', 'Parsing attachment data', { raw: attachmentData });
                return JSON.parse(attachmentData);
            } catch (error) {
                console.error('Error parsing attachment data:', error);
                return null;
            }
        };

        // Attachment item clicks for preview
        const attachmentItems = container.querySelectorAll('.gmail-attachment-item');
        console.log('Found attachment items:', attachmentItems.length);
        this.debugLog('Event Binding', `Found ${attachmentItems.length} attachment items to bind`);

        // Add a click handler to the container itself for event delegation
        container.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const attachmentItem = target.closest('.gmail-attachment-item') as HTMLElement;
            
            console.log('Container click detected:', {
                target: target.tagName,
                className: target.className,
                attachmentItem: attachmentItem?.tagName,
                attachmentItemClass: attachmentItem?.className
            });

            if (!attachmentItem) return;
            
            // Don't trigger if clicking action buttons
            if (target.closest('.attachment-actions')) {
                console.log('Action button clicked, skipping main handler');
                return;
            }

            const attachment = getAttachmentFromElement(attachmentItem);
            if (!attachment) {
                console.error('Could not find attachment data');
                return;
            }

            console.log('Processing attachment click:', attachment);
            
            try {
                // Use lazy loading for Gmail attachments
                if (attachment.attachmentId && !attachment.content) {
                    const attachmentManager = AttachmentManagerSingleton.getInstance();
                    await attachmentManager.previewAttachmentWithLoading(attachment);
                } else {
                    await this.previewAttachment(attachment);
                }
            } catch (error) {
                console.error('Error handling attachment click:', error);
                if (typeof (window as any).showNotification !== 'undefined') {
                    (window as any).showNotification('Failed to preview attachment: ' + (error as Error).message, 'error');
                }
            }
        });

        // Individual item event listeners for debugging
        attachmentItems.forEach((item, idx) => {
            console.log('Setting up click handler for item:', idx, item.outerHTML);
            this.debugLog('Event Binding', `Binding click handler to item ${idx}`, {
                className: item.className,
                dataIndex: (item as HTMLElement).dataset.attachmentIndex
            });

            // Add click handler for debugging purposes
            item.addEventListener('click', (e) => {
                console.log('Direct item click detected:', {
                    index: idx,
                    target: (e.target as HTMLElement).tagName,
                    currentTarget: (e.currentTarget as HTMLElement).tagName,
                    className: item.className
                });
            });
        });

        // Action buttons (preview and download)
        const actionButtons = container.querySelectorAll('.attachment-btn');
        this.debugLog('Event Binding', `Found ${actionButtons.length} action buttons to bind`);
        
        actionButtons.forEach((btn, idx) => {
            const action = (btn as HTMLElement).dataset.action;
            this.debugLog('Event Binding', `Binding click handler to ${action} button ${idx}`, {
                className: btn.className,
                action,
                dataIndex: (btn as HTMLElement).dataset.attachmentIndex
            });

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const attachment = getAttachmentFromElement(e.target as HTMLElement);
                if (!attachment) {
                    console.error('Could not find attachment data');
                    return;
                }
                
                this.debugLog('Button Click', `${action} button clicked`, {
                    attachment,
                    action
                });
                
                try {
                    const attachmentManager = AttachmentManagerSingleton.getInstance();
                    
                    if (action === 'preview') {
                        await attachmentManager.previewAttachmentWithLoading(attachment);
                    } else if (action === 'download') {
                        await attachmentManager.downloadAttachmentWithLoading(attachment);
                    }
                } catch (error) {
                    console.error(`Error ${action}ing attachment:`, error);
                    if (typeof (window as any).showNotification !== 'undefined') {
                        (window as any).showNotification(`Failed to ${action} attachment: ` + (error as Error).message, 'error');
                    }
                }
            });
        });
    }

    /**
     * Preview attachment in modal
     */
    static async previewAttachment(attachment: Attachment): Promise<void> {
        const startTime = performance.now();
        
        this.debugLog('Preview Start', 'Starting attachment preview', {
            filename: attachment.filename,
            type: attachment.contentType,
            size: this.formatFileSize(attachment.size),
            hasContent: !!attachment.content,
            hasAttachmentId: !!attachment.attachmentId,
            messageId: attachment.messageId,
            contentId: attachment.contentId,
            isInline: attachment.isInline
        });

        try {
            const fileType = this.getFileTypeCategory(attachment.contentType);

            if (AttachmentHandler.NATIVE_PREVIEW_TYPES.includes(fileType)) {
                this.debugLog('Native Preview', `Requesting native OS preview for ${fileType} attachment`);

                // Add security and size checks before proceeding
                const MAX_PREVIEW_SIZE = 200 * 1024 * 1024; // 200 MB
                if (attachment.size > MAX_PREVIEW_SIZE) {
                    if (typeof (window as any).showNotification !== 'undefined') {
                        (window as any).showNotification('File is too large for preview (> 200MB). Please download it instead.', 'warning');
                    }
                    return; // Stop the preview
                }

                const dangerousExtensions = ['.exe', '.bat', '.cmd', '.msi', '.scr'];
                const filename = attachment.filename || attachment.name || '';
                const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
            
                if (dangerousExtensions.includes(ext)) {
                    if (typeof (window as any).showNotification !== 'undefined') {
                        (window as any).showNotification('Warning: This file type may be dangerous. Opening with caution.', 'warning');
                    }
                    // Add a delay to give the user time to see the warning
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

                // Ensure content is available, especially for lazy-loaded Gmail attachments
                if (!attachment.content && attachment.attachmentId) {
                    const manager = AttachmentManagerSingleton.getInstance();
                    attachment.content = await manager.fetchGmailAttachmentContent(attachment);
                }

                if (!attachment.content) {
                    throw new Error('Attachment content is not available for native preview.');
                }
                
                // The content could be a Buffer or a string, ensure it's base64
                let base64Content: string;
                if (typeof attachment.content === 'string') {
                    base64Content = attachment.content;
                } else if (Buffer.isBuffer(attachment.content)) {
                    base64Content = attachment.content.toString('base64');
                } else {
                    throw new Error('Unsupported attachment content type for native preview.');
                }

                // Send data to main process to handle file saving and opening
                const ipcRenderer = (window as any).require('electron').ipcRenderer;
                const result = await ipcRenderer.invoke('preview-file-native', {
                    filename: attachment.filename || 'attachment.dat',
                    data: base64Content
                });

                if (!result.success) {
                    throw new Error(result.error || `Failed to open ${fileType} in native viewer.`);
                }

                if (typeof (window as any).showNotification !== 'undefined') {
                    (window as any).showNotification(`Opening ${attachment.filename} in your default app...`, 'info');
                }
            } else {
                const modal = await this.createPreviewModal(attachment);
                document.body.appendChild(modal);

                // Force layout calculation before showing modal
                modal.offsetHeight; // Force reflow

                // Show modal with animation - use setTimeout to ensure proper timing
                setTimeout(() => {
                    modal.style.opacity = '1';
                    const modalContent = modal.querySelector('.modal-content') as HTMLElement;
                    if (modalContent) {
                        modalContent.style.transform = 'translateY(0)';
                    }
                    
                    this.debugLog('Modal Display', 'Modal animation started', {
                        modalOpacity: modal.style.opacity,
                        contentTransform: modalContent?.style.transform,
                        modalRect: modal.getBoundingClientRect(),
                        contentRect: modalContent?.getBoundingClientRect()
                    });
                }, 10); // Small delay to ensure DOM is ready
            }

        } catch (error) {
            const endTime = performance.now();
            this.debugLog('Preview Error', 'Error in preview process', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack
                } : 'Unknown error',
                processingTime: `${(endTime - startTime).toFixed(2)}ms`,
                attachment: {
                    filename: attachment.filename,
                    type: attachment.contentType,
                    size: this.formatFileSize(attachment.size)
                }
            });
            
            console.error('Error previewing attachment:', error);
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Unable to preview attachment: ' + (error as Error).message, 'error');
            } else {
                alert('Unable to preview attachment: ' + (error as Error).message);
            }
        }
    }

    /**
     * Download attachment
     */
    static async downloadAttachment(attachment: Attachment): Promise<void> {
        try {
            // Validate attachment data
            if (!attachment) {
                throw new Error('Invalid attachment data');
            }

            // Check for potentially dangerous file types
            const dangerousExtensions = ['.exe', '.bat', '.cmd', '.msi', '.scr'];
            const filename = attachment.filename || attachment.name || '';
            const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
            
            if (dangerousExtensions.includes(ext)) {
                if (typeof (window as any).showNotification !== 'undefined') {
                    (window as any).showNotification('Warning: Executable files may be dangerous. Please verify the source.', 'warning');
                }
                // Add a 3-second delay for potentially dangerous files
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Handle Gmail attachments
            if (attachment.attachmentId && !attachment.content) {
                const manager = AttachmentManagerSingleton.getInstance();
                await manager.downloadAttachmentWithLoading(attachment);
                return;
            }

            // Create data URL for download
            const dataURL = await this.createDataURL(attachment);
            
            // Create and trigger download link
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = attachment.filename || attachment.name || 'attachment';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Show success notification
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification(`Downloaded ${attachment.filename || 'attachment'}`, 'success');
            }

        } catch (error) {
            console.error('Error downloading attachment:', error);
            let errorMessage = (error as Error).message;
            
            // Provide more specific error messages
            if (errorMessage.includes('MIME type')) {
                errorMessage = 'This file type is not supported for download';
            } else if (errorMessage.includes('size')) {
                errorMessage = 'The file is too large to download directly. Please use your email client.';
            } else if (errorMessage.includes('network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }
            
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Failed to download: ' + errorMessage, 'error');
            }
            throw error;
        }
    }

    /**
     * Validate dependencies
     */
    static validateDependencies(): AttachmentValidationResult {
        const missing: string[] = [];
        
        // Check for SafeHTML (optional but recommended)
        if (typeof (globalThis as any).SafeHTML === 'undefined') {
            console.warn('SafeHTML not available - HTML will not be escaped');
        }
        
        // Check for required DOM APIs
        if (typeof document === 'undefined') {
            missing.push('DOM document');
        }
        
        if (typeof window === 'undefined') {
            missing.push('window object');
        }
        
        return {
            isValid: missing.length === 0,
            missing
        };
    }

    /**
     * Initialize attachment handler
     */
    static initialize(): boolean {
        const validation = this.validateDependencies();
        
        if (!validation.isValid) {
            console.error('AttachmentHandler initialization failed. Missing dependencies:', validation.missing);
            return false;
        }
        
        console.log('AttachmentHandler initialized successfully');
        return true;
    }

    /**
     * Create preview modal
     */
    private static async createPreviewModal(attachment: Attachment): Promise<HTMLElement> {
        this.debugLog('Modal Creation', 'Creating preview modal', {
            attachment: {
                name: attachment.filename || attachment.name,
                type: attachment.contentType,
                size: this.formatFileSize(attachment.size)
            }
        });

        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'attachment-preview-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'preview-title');
        
        // Add modal styles with proper flexbox centering
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
            padding: 20px;
            box-sizing: border-box;
        `;

        try {
            // Create modal content container
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            // Content-based sizing with 80% window height
            modalContent.style.cssText = `
                background: white;
                border-radius: 12px;
                max-width: calc(100vw - 40px);
                max-height: calc(80vh - 40px);
                width: auto;
                height: 80vh;
                overflow: hidden;
                position: relative;
                box-shadow: 0 2px 16px rgba(0, 0, 0, 0.15);
                display: flex;
                flex-direction: column;
                min-width: 320px;
                min-height: 400px;
                transform: translateY(10px);
                transition: transform 0.2s ease-in-out;
            `;

            // Create minimal header
            let header: HTMLElement | null = null;
            
            header = document.createElement('div');
            header.style.cssText = `
                padding: 16px 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8f9fa;
                flex-shrink: 0;
            `;

            // Create title section
            const titleSection = document.createElement('div');
            const fileName = attachment.filename || attachment.name || 'Attachment';
            const fileSize = this.formatFileSize(attachment.size);
            const fileIcon = this.getFileIcon(attachment.contentType, attachment.filename);
            
            titleSection.innerHTML = `
                <h3 id="preview-title" style="margin: 0; font-size: 16px; color: #333; display: flex; align-items: center; gap: 8px;">
                    <i class="${fileIcon}" aria-hidden="true" style="font-size: 20px; color: #666;"></i>
                    <span style="word-break: break-word; max-width: 500px; overflow: hidden; text-overflow: ellipsis;">${fileName}</span>
                </h3>
                <p style="margin: 4px 0 0 28px; color: #666; font-size: 13px;">${fileSize} • ${attachment.contentType}</p>
            `;

            // Create actions section
            const actions = document.createElement('div');
            actions.style.cssText = `
                display: flex;
                gap: 8px;
                align-items: center;
            `;

            // Create download button
            const downloadBtn = document.createElement('button');
            downloadBtn.innerHTML = '<i class="fas fa-download" aria-hidden="true"></i>';
            downloadBtn.title = 'Download';
            downloadBtn.setAttribute('aria-label', 'Download attachment');
            downloadBtn.style.cssText = `
                background: #f0f0f0;
                border: none;
                border-radius: 6px;
                padding: 8px;
                cursor: pointer;
                color: #444;
                transition: all 0.2s ease;
            `;
            downloadBtn.addEventListener('mouseover', () => downloadBtn.style.background = '#e0e0e0');
            downloadBtn.addEventListener('mouseout', () => downloadBtn.style.background = '#f0f0f0');
            downloadBtn.addEventListener('click', () => this.downloadAttachment(attachment));

            actions.appendChild(downloadBtn);
            header.appendChild(titleSection);
            header.appendChild(actions);

            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
            closeBtn.title = 'Close';
            closeBtn.setAttribute('aria-label', 'Close preview');
            
            closeBtn.style.cssText = `
                background: #f0f0f0;
                border: none;
                border-radius: 6px;
                padding: 8px;
                cursor: pointer;
                color: #444;
                transition: all 0.2s ease;
            `;
            closeBtn.addEventListener('mouseover', () => closeBtn.style.background = '#e0e0e0');
            closeBtn.addEventListener('mouseout', () => closeBtn.style.background = '#f0f0f0');
            
            if (header) {
                const actions = header.querySelector('div[style*="gap: 8px"]') as HTMLElement;
                if (actions) actions.appendChild(closeBtn);
            }

            // Create preview content directly without extra wrapper
            const previewContent = await this.createAttachmentPreview(attachment);
            
            // For non-PDF files, create wrapper with proper sizing (80% height)
            const previewContainer = document.createElement('div');
            previewContainer.className = 'preview-container';
            previewContainer.style.cssText = `
                flex: 1;
                overflow: hidden;
                padding: 0;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                background: ${this.getFileTypeCategory(attachment.contentType) === 'image' ? '#f0f0f0' : 'white'};
                min-height: 400px;
                height: calc(80vh - 120px);
                position: relative;
            `;
            previewContainer.appendChild(previewContent);
            const finalPreviewElement = previewContainer;
            
            // Debug container dimensions
            this.debugLog('Preview Container', `Container optimized for standard preview`, {
                hasHeader: true,
                containerStyle: finalPreviewElement.style.cssText,
                contentType: attachment.contentType,
            });

            // Assemble modal
            if (header) {
                modalContent.appendChild(header);
            }
            modalContent.appendChild(finalPreviewElement);
            
            modal.appendChild(modalContent);

            // Add close handlers
            const closeModal = () => {
                modal.style.opacity = '0';
                modalContent.style.transform = 'translateY(20px)';
                setTimeout(() => modal.remove(), 200);
            };

            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // Add keyboard navigation
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    closeModal();
                }
            };
            document.addEventListener('keydown', handleKeyDown);

            // Clean up event listeners when modal is closed
            const cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown);
                modal.remove();
            };
            modal.addEventListener('remove', cleanup);

            // Focus management
            setTimeout(() => closeBtn.focus(), 100);

            // Set up a callback to measure dimensions after modal is displayed
            setTimeout(() => {
                this.debugLog('Modal Creation', 'Preview modal created successfully', {
                    type: attachment.contentType,
                    size: this.formatFileSize(attachment.size),
                    modalDimensions: {
                        width: modalContent.offsetWidth,
                        height: modalContent.offsetHeight
                    }
                });
            }, 50); // Measure after animation completes

            return modal;

        } catch (error) {
            this.debugLog('Modal Creation', 'Error creating preview modal', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack
                } : 'Unknown error'
            });
            throw error;
        }
    }
}

// Legacy function exports for backward compatibility
function createAttachmentList(attachments: Attachment[]): HTMLElement | null {
    return AttachmentHandler.createAttachmentList(attachments);
}

async function previewAttachment(attachment: Attachment): Promise<void> {
    return AttachmentHandler.previewAttachment(attachment);
}

async function downloadAttachment(attachment: Attachment): Promise<void> {
    return AttachmentHandler.downloadAttachment(attachment);
}

function formatFileSize(bytes: number): string {
    return AttachmentHandler.formatFileSize(bytes);
}

function getFileIcon(mimeType: string, filename?: string): string {
    return AttachmentHandler.getFileIcon(mimeType, filename);
}

function getFileTypeCategory(mimeType: string): FileTypeCategory {
    return AttachmentHandler.getFileTypeCategory(mimeType);
}

// Make AttachmentHandler and AttachmentManager available globally
if (typeof window !== 'undefined') {
    (window as any).AttachmentHandler = AttachmentHandler;
    (window as any).AttachmentManager = AttachmentManagerSingleton;
    
    // Legacy function exports
    (window as any).createAttachmentList = createAttachmentList;
    (window as any).previewAttachment = previewAttachment;
    (window as any).downloadAttachment = downloadAttachment;
    (window as any).formatFileSize = formatFileSize;
    (window as any).getFileIcon = getFileIcon;
    (window as any).getFileTypeCategory = getFileTypeCategory;
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            AttachmentHandler.initialize();
        });
    } else {
        AttachmentHandler.initialize();
    }

    // Unit tests for AttachmentHandler
    (window as any).testAttachmentHandler = () => {
        const testAttachment: Attachment = {
            name: 'test.txt',
            filename: 'test.txt',
            url: 'https://example.com/test.txt',
            contentType: 'text/plain',
            size: 100,
            isInline: false,
            isTemporary: false,
            content: btoa('Hello, world!'),
        };
        // Test downloadAttachment (should trigger a download)
        try {
            AttachmentHandler.downloadAttachment(testAttachment);
            console.log('✅ downloadAttachment test passed');
        } catch (e) {
            console.error('❌ downloadAttachment test failed', e);
        }
        // Test previewAttachment (should open a modal or preview)
        try {
            AttachmentHandler.previewAttachment(testAttachment);
            console.log('✅ previewAttachment test passed');
        } catch (e) {
            console.error('❌ previewAttachment test failed', e);
        }
        return true;
    };
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AttachmentHandler,
        createAttachmentList,
        previewAttachment,
        downloadAttachment,
        formatFileSize,
        getFileIcon,
        getFileTypeCategory
    };
}

// Export the AttachmentHandler class and helper functions
export { AttachmentHandler, AttachmentManagerSingleton };

// Export helper functions for direct use
export {
    createAttachmentList,
    previewAttachment,
    downloadAttachment,
    formatFileSize,
    getFileIcon,
    getFileTypeCategory
}; 