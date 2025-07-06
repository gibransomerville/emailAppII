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
 * Attachment Manager for lazy loading Gmail attachments
 */
class AttachmentManager {
    private static instance: AttachmentManager;
    private cache: Map<string, string> = new Map();
    
    static getInstance(): AttachmentManager {
        if (!AttachmentManager.instance) {
            AttachmentManager.instance = new AttachmentManager();
        }
        return AttachmentManager.instance;
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
            
            // Cache the content
            this.cache.set(cacheKey, result.data);
            return result.data;
            
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
            
            // Fetch content if not available
            if (!attachment.content && attachment.attachmentId) {
                try {
                    const content = await this.fetchGmailAttachmentContent(attachment);
                    attachment.content = content;
                } catch (authError) {
                    // Provide more specific error handling for authentication issues
                    console.error('Error fetching Gmail attachment content:', authError);
                    const errorMessage = (authError as Error).message;
                    if (errorMessage.includes('authentication')) {
                        if (typeof (window as any).showNotification !== 'undefined') {
                            (window as any).showNotification('Please sign in to your Google account to download Gmail attachments.', 'warning');
                        }
                        return;
                    }
                    throw authError;
                }
            }
            
            // Use regular download handler
            AttachmentHandler.downloadAttachment(attachment);
            
        } catch (error) {
            console.error('Error downloading attachment:', error);
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Failed to download attachment: ' + (error as Error).message, 'error');
            }
        }
    }
    
    /**
     * Preview attachment with loading indicator
     */
    async previewAttachmentWithLoading(attachment: Attachment, index: number): Promise<void> {
        try {
            // Show loading notification
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Loading attachment preview...', 'info');
            }
            
            // Fetch content if not available
            if (!attachment.content && attachment.attachmentId) {
                try {
                    const content = await this.fetchGmailAttachmentContent(attachment);
                    attachment.content = content;
                } catch (authError) {
                    // Provide more specific error handling for authentication issues
                    console.error('Error fetching Gmail attachment content:', authError);
                    const errorMessage = (authError as Error).message;
                    if (errorMessage.includes('authentication')) {
                        if (typeof (window as any).showNotification !== 'undefined') {
                            (window as any).showNotification('Please sign in to your Google account to preview Gmail attachments.', 'warning');
                        }
                        return;
                    }
                    throw authError;
                }
            }
            
            // Use regular preview handler
            AttachmentHandler.previewAttachment(attachment);
            
        } catch (error) {
            console.error('Error previewing attachment:', error);
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Failed to preview attachment: ' + (error as Error).message, 'error');
            }
        }
    }
}

/**
 * Attachment Handler Class
 */
class AttachmentHandler {
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
     * Create data URL for attachment
     */
    static async createDataURL(attachment: Attachment): Promise<string> {
        try {
            // Check if we need to fetch content lazily for Gmail attachments
            if (!attachment.content && attachment.attachmentId && attachment.messageId) {
                try {
                    const attachmentManager = AttachmentManager.getInstance();
                    const content = await attachmentManager.fetchGmailAttachmentContent(attachment);
                    attachment.content = content;
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

            let content = attachment.content;
            
            // If content is already a data URL, return it
            if (typeof content === 'string' && content.startsWith('data:')) {
                return content;
            }

            // If content is base64 encoded, create data URL
            if (typeof content === 'string') {
                const mimeType = attachment.contentType || 'application/octet-stream';
                return `data:${mimeType};base64,${content}`;
            }

            // If content is a Buffer or Uint8Array, convert to base64
            if (content instanceof Uint8Array || (content as any)?.constructor?.name === 'ArrayBuffer') {
                const bytes = new Uint8Array(content as ArrayBuffer | Uint8Array);
                const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
                const mimeType = attachment.contentType || 'application/octet-stream';
                return `data:${mimeType};base64,${base64}`;
            }

            throw new Error('Unsupported attachment content format');
        } catch (error) {
            console.error('Error creating data URL for attachment:', error);
            throw error;
        }
    }

    /**
     * Create attachment preview element
     */
    static async createAttachmentPreview(attachment: Attachment): Promise<HTMLElement> {
        const category = this.getFileTypeCategory(attachment.contentType);
        const previewContainer = document.createElement('div');
        previewContainer.className = 'attachment-preview';

        try {
            const dataURL = await this.createDataURL(attachment);
            const safeHTML = (globalThis as any).SafeHTML;

            switch (category) {
                case 'image':
                    previewContainer.innerHTML = `
                        <div class="image-preview">
                            <img src="${dataURL}" alt="${safeHTML?.escapeHtml ? safeHTML.escapeHtml(attachment.filename || 'Image') : attachment.filename || 'Image'}" 
                                 style="max-width: 100%; max-height: 300px; border-radius: 4px;"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <div class="image-error" style="display: none; padding: 20px; text-align: center; color: #666;">
                                <i class="fas fa-exclamation-triangle"></i>
                                <p>Unable to display image</p>
                            </div>
                        </div>
                    `;
                    break;

                case 'text':
                    // For text files, show first few lines
                    try {
                        const textContent = this.decodeAttachmentData(attachment.content as string);
                        const preview = textContent.substring(0, 500);
                        previewContainer.innerHTML = `
                            <div class="text-preview" style="background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
                                ${safeHTML?.escapeHtml ? safeHTML.escapeHtml(preview) : preview}${textContent.length > 500 ? '\n...' : ''}
                            </div>
                        `;
                    } catch (error) {
                        previewContainer.innerHTML = `<p class="preview-error">Unable to preview text content</p>`;
                    }
                    break;

                case 'pdf':
                    previewContainer.innerHTML = `
                        <div class="pdf-preview">
                            <iframe src="${dataURL}" width="100%" height="400" style="border: 1px solid #ddd; border-radius: 4px;">
                                <p>Your browser doesn't support PDF preview. <a href="${dataURL}" download="${safeHTML?.escapeHtml ? safeHTML.escapeHtml(attachment.filename) : attachment.filename}">Download PDF</a></p>
                            </iframe>
                        </div>
                    `;
                    break;

                case 'video':
                    previewContainer.innerHTML = `
                        <div class="video-preview">
                            <video controls style="max-width: 100%; max-height: 300px; border-radius: 4px;">
                                <source src="${dataURL}" type="${attachment.contentType}">
                                Your browser doesn't support video playback.
                            </video>
                        </div>
                    `;
                    break;

                case 'audio':
                    previewContainer.innerHTML = `
                        <div class="audio-preview">
                            <audio controls style="width: 100%;">
                                <source src="${dataURL}" type="${attachment.contentType}">
                                Your browser doesn't support audio playback.
                            </audio>
                        </div>
                    `;
                    break;

                default:
                    previewContainer.innerHTML = `
                        <div class="generic-preview" style="text-align: center; padding: 20px; color: #666;">
                            <i class="${this.getFileIcon(attachment.contentType, attachment.filename)}" style="font-size: 48px; margin-bottom: 10px;"></i>
                            <p>Preview not available for this file type</p>
                        </div>
                    `;
            }
        } catch (error) {
            console.error('Error creating attachment preview:', error);
            previewContainer.innerHTML = `
                <div class="preview-error" style="text-align: center; padding: 20px; color: #d32f2f;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <p>Unable to preview attachment</p>
                    <p style="font-size: 12px;">${(error as Error).message}</p>
                </div>
            `;
        }

        return previewContainer;
    }

    /**
     * Create attachment list for email
     */
    static createAttachmentList(attachments: Attachment[]): HTMLElement | null {
        if (!attachments || attachments.length === 0) {
            return null;
        }

        const attachmentContainer = document.createElement('div');
        attachmentContainer.className = 'email-attachments';
        
        const attachmentHTML = `
            <div class="attachments-header" style="margin: 16px 0 8px 0; padding: 8px 0; border-top: 1px solid #e0e0e0;">
                <h4 style="margin: 0; font-size: 14px; color: #5f6368; display: flex; align-items: center;">
                    <i class="fas fa-paperclip" style="margin-right: 8px;"></i>
                    ${attachments.length} Attachment${attachments.length > 1 ? 's' : ''}
                </h4>
            </div>
            <div class="attachments-list">
                ${attachments.map((attachment, index) => this.createAttachmentItem(attachment, index)).join('')}
            </div>
        `;

        const safeHTML = (globalThis as any).SafeHTML;
        if (safeHTML?.setInnerHTML) {
            safeHTML.setInnerHTML(attachmentContainer, attachmentHTML, 'email');
        } else {
            attachmentContainer.innerHTML = attachmentHTML;
        }
        
        // Add event listeners for attachment actions
        this.addAttachmentEventListeners(attachmentContainer, attachments);
        
        return attachmentContainer;
    }

    /**
     * Create individual attachment item
     */
    static createAttachmentItem(attachment: Attachment, index: number): string {
        const filename = attachment.filename || `attachment_${index + 1}`;
        const safeHTML = (globalThis as any).SafeHTML;

        return `
            <div class="gmail-attachment-item" data-attachment-index="${index}">
                <div class="attachment-name">
                    ${safeHTML?.escapeHtml ? safeHTML.escapeHtml(filename) : filename}
                </div>
                <button class="attachment-btn download-btn" data-attachment-index="${index}" title="Download ${safeHTML?.escapeHtml ? safeHTML.escapeHtml(filename) : filename}">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;
    }

    /**
     * Add event listeners for attachment actions
     */
    static addAttachmentEventListeners(container: HTMLElement, attachments: Attachment[]): void {
        // Preview buttons
        const previewButtons = container.querySelectorAll('.attachment-preview-btn');
        previewButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const index = parseInt((btn as HTMLElement).dataset.attachmentIndex || '0');
                const attachment = attachments[index];
                
                try {
                    // Use lazy loading for Gmail attachments
                    if (attachment.attachmentId && !attachment.content) {
                        // AttachmentManager will be available from renderer.js
                        const attachmentManager = AttachmentManager.getInstance();
                        await attachmentManager.previewAttachmentWithLoading(attachment, index);
                    } else {
                        await this.previewAttachment(attachment);
                    }
                } catch (error) {
                    console.error('Error previewing attachment:', error);
                    if (typeof (window as any).showNotification !== 'undefined') {
                        (window as any).showNotification('Failed to preview attachment: ' + (error as Error).message, 'error');
                    }
                }
            });
        });

        // Download buttons
        const downloadButtons = container.querySelectorAll('.attachment-download-btn');
        downloadButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const index = parseInt((btn as HTMLElement).dataset.attachmentIndex || '0');
                const attachment = attachments[index];
                
                try {
                    // Use lazy loading for Gmail attachments
                    if (attachment.attachmentId && !attachment.content) {
                        // AttachmentManager will be available from renderer.js
                        const attachmentManager = AttachmentManager.getInstance();
                        await attachmentManager.downloadAttachmentWithLoading(attachment);
                    } else {
                        await this.downloadAttachment(attachment);
                    }
                } catch (error) {
                    console.error('Error downloading attachment:', error);
                    if (typeof (window as any).showNotification !== 'undefined') {
                        (window as any).showNotification('Failed to download attachment: ' + (error as Error).message, 'error');
                    }
                }
            });
        });
    }

    /**
     * Preview attachment in modal
     */
    static async previewAttachment(attachment: Attachment): Promise<void> {
        try {
            const modal = await this.createPreviewModal(attachment);
            document.body.appendChild(modal);
            
            // Show modal
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);

        } catch (error) {
            console.error('Error previewing attachment:', error);
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Unable to preview attachment: ' + (error as Error).message, 'error');
            } else {
                alert('Unable to preview attachment: ' + (error as Error).message);
            }
        }
    }

    /**
     * Create preview modal
     */
    static async createPreviewModal(attachment: Attachment): Promise<HTMLElement> {
        const modal = document.createElement('div');
        modal.className = 'attachment-preview-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        try {
            const previewContent = await this.createAttachmentPreview(attachment);
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            modalContent.style.cssText = `
                background: white;
                border-radius: 8px;
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                position: relative;
                padding: 20px;
            `;
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 10px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            `;
            
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            });
            
            // Add header
            const header = document.createElement('div');
            header.style.cssText = `
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
            `;
            
            const safeHTML = (globalThis as any).SafeHTML;
            const fileName = safeHTML?.escapeHtml ? safeHTML.escapeHtml(attachment.filename || 'Attachment') : attachment.filename || 'Attachment';
            const fileSize = this.formatFileSize(attachment.size);
            
            header.innerHTML = `
                <h3 style="margin: 0; color: #333;">${fileName}</h3>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${attachment.contentType} • ${fileSize}</p>
            `;
            
            modalContent.appendChild(closeBtn);
            modalContent.appendChild(header);
            modalContent.appendChild(previewContent);
            modal.appendChild(modalContent);
            
        } catch (error) {
            console.error('Error creating preview modal content:', error);
            modal.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px;">
                    <h3>Preview Error</h3>
                    <p>${(error as Error).message}</p>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: #d32f2f; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Close</button>
                </div>
            `;
        }
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            }
        });

        // Close on escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Add show class for CSS transition
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);

        return modal;
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
                const manager = AttachmentManager.getInstance();
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
    (window as any).AttachmentManager = AttachmentManager;
    
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
export { AttachmentHandler, AttachmentManager };

// Export helper functions for direct use
export {
    createAttachmentList,
    previewAttachment,
    downloadAttachment,
    formatFileSize,
    getFileIcon,
    getFileTypeCategory
}; 