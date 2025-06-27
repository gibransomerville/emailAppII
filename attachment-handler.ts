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

import { Attachment } from './types/email';

// File type categories
type FileTypeCategory = 'image' | 'text' | 'pdf' | 'video' | 'audio' | 'document' | 'archive' | 'unknown';

interface AttachmentValidationResult {
    isValid: boolean;
    missing: string[];
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
    static createDataURL(attachment: Attachment): string {
        try {
            if (!attachment.content) {
                throw new Error('No attachment content available');
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
    static createAttachmentPreview(attachment: Attachment): HTMLElement {
        const category = this.getFileTypeCategory(attachment.contentType);
        const previewContainer = document.createElement('div');
        previewContainer.className = 'attachment-preview';

        try {
            const dataURL = this.createDataURL(attachment);
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
        const fileSize = this.formatFileSize(attachment.size);
        const icon = this.getFileIcon(attachment.contentType, attachment.filename);
        const filename = attachment.filename || `attachment_${index + 1}`;
        const isPreviewable = this.getFileTypeCategory(attachment.contentType) !== 'unknown';
        const safeHTML = (globalThis as any).SafeHTML;

        return `
            <div class="attachment-item" data-attachment-index="${index}" style="display: flex; align-items: center; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px; background: #fafafa;">
                <div class="attachment-icon" style="margin-right: 12px; color: #5f6368;">
                    <i class="${icon}" style="font-size: 20px;"></i>
                </div>
                <div class="attachment-info" style="flex-grow: 1; min-width: 0;">
                    <div class="attachment-name" style="font-weight: 500; font-size: 14px; color: #202124; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${safeHTML?.escapeHtml ? safeHTML.escapeHtml(filename) : filename}
                    </div>
                    <div class="attachment-details" style="font-size: 12px; color: #5f6368;">
                        ${safeHTML?.escapeHtml ? safeHTML.escapeHtml(attachment.contentType || 'Unknown type') : (attachment.contentType || 'Unknown type')} • ${fileSize}
                    </div>
                </div>
                <div class="attachment-actions" style="display: flex; gap: 8px;">
                    ${isPreviewable ? `
                        <button class="attachment-preview-btn" data-attachment-index="${index}" 
                                style="padding: 4px 8px; border: 1px solid #dadce0; border-radius: 4px; background: white; color: #1a73e8; cursor: pointer; font-size: 12px;">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                    ` : ''}
                    <button class="attachment-download-btn" data-attachment-index="${index}"
                            style="padding: 4px 8px; border: 1px solid #dadce0; border-radius: 4px; background: white; color: #1a73e8; cursor: pointer; font-size: 12px;">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
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
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt((btn as HTMLElement).dataset.attachmentIndex || '0');
                const attachment = attachments[index];
                
                // Use lazy loading for Gmail attachments
                if (attachment.attachmentId && !attachment.content) {
                    // AttachmentManager will be available from renderer.js
                    const attachmentManager = (globalThis as any).AttachmentManager;
                    if (attachmentManager) {
                        attachmentManager.previewAttachmentWithLoading(attachment, index);
                    } else {
                        this.previewAttachment(attachment);
                    }
                } else {
                    this.previewAttachment(attachment);
                }
            });
        });

        // Download buttons
        const downloadButtons = container.querySelectorAll('.attachment-download-btn');
        downloadButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt((btn as HTMLElement).dataset.attachmentIndex || '0');
                const attachment = attachments[index];
                
                // Use lazy loading for Gmail attachments
                if (attachment.attachmentId && !attachment.content) {
                    // AttachmentManager will be available from renderer.js
                    const attachmentManager = (globalThis as any).AttachmentManager;
                    if (attachmentManager) {
                        attachmentManager.downloadAttachmentWithLoading(attachment);
                    } else {
                        this.downloadAttachment(attachment);
                    }
                } else {
                    this.downloadAttachment(attachment);
                }
            });
        });
    }

    /**
     * Preview attachment in modal
     */
    static previewAttachment(attachment: Attachment): void {
        try {
            const modal = this.createPreviewModal(attachment);
            document.body.appendChild(modal);
            
            // Show modal
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);

        } catch (error) {
            console.error('Error previewing attachment:', error);
            // showNotification will be available from renderer.js
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
    static createPreviewModal(attachment: Attachment): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'attachment-preview-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
            position: relative;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
            border-radius: 8px 8px 0 0;
        `;

        const title = document.createElement('h3');
        title.style.cssText = 'margin: 0; font-size: 16px; color: #202124;';
        title.textContent = attachment.filename || 'Attachment Preview';

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #5f6368;
            padding: 4px;
        `;
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.style.cssText = 'padding: 20px;';
        
        const preview = this.createAttachmentPreview(attachment);
        content.appendChild(preview);

        modalContent.appendChild(header);
        modalContent.appendChild(content);
        modal.appendChild(modalContent);

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
    static downloadAttachment(attachment: Attachment): void {
        try {
            const dataURL = this.createDataURL(attachment);
            
            // Create temporary download link
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = attachment.filename || 'attachment';
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success notification
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification(`Downloaded ${attachment.filename}`, 'success');
            }
            
        } catch (error) {
            console.error('Error downloading attachment:', error);
            if (typeof (window as any).showNotification !== 'undefined') {
                (window as any).showNotification('Unable to download attachment: ' + (error as Error).message, 'error');
            } else {
                alert('Unable to download attachment: ' + (error as Error).message);
            }
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

function previewAttachment(attachment: Attachment): void {
    return AttachmentHandler.previewAttachment(attachment);
}

function downloadAttachment(attachment: Attachment): void {
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

// Make AttachmentHandler available globally
if (typeof window !== 'undefined') {
    (window as any).AttachmentHandler = AttachmentHandler;
    
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

export default AttachmentHandler;
export { 
    AttachmentHandler, 
    createAttachmentList, 
    previewAttachment, 
    downloadAttachment, 
    formatFileSize, 
    getFileIcon, 
    getFileTypeCategory,
    type FileTypeCategory,
    type AttachmentValidationResult
}; 