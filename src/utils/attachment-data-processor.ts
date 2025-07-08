/**
 * Attachment Data Processor
 * Handles safe conversion of attachment data between different formats
 * Provides validation and error handling for base64, binary, and data URL formats
 * 
 * @author Email App Modular Architecture
 * @version 1.0.0
 */

import { Attachment } from '../../types/email.js';

interface AttachmentDataInfo {
    format: 'base64' | 'dataurl' | 'binary' | 'text' | 'unknown';
    mimeType?: string;
    size: number;
    isValid: boolean;
    encoding?: string;
}

interface ProcessedAttachmentData {
    arrayBuffer: ArrayBuffer;
    dataUrl: string;
    base64: string;
    info: AttachmentDataInfo;
}

/**
 * Attachment Data Processor Class
 */
export class AttachmentDataProcessor {
    
    /**
     * Analyze attachment content to determine format and validity
     */
    static analyzeAttachmentData(attachment: Attachment): AttachmentDataInfo {
        const content = attachment.content;
        
        if (!content) {
            return {
                format: 'unknown',
                size: 0,
                isValid: false
            };
        }

        // Check if content is a data URL
        if (typeof content === 'string' && content.startsWith('data:')) {
            const dataUrlMatch = content.match(/^data:([^;]+);base64,(.+)$/);
            if (dataUrlMatch) {
                const [, mimeType, base64Data] = dataUrlMatch;
                return {
                    format: 'dataurl',
                    mimeType,
                    size: content.length,
                    isValid: this.isValidBase64(base64Data),
                    encoding: 'base64'
                };
            }
            
            return {
                format: 'dataurl',
                size: content.length,
                isValid: false
            };
        }

        // Check if content is base64 string
        if (typeof content === 'string') {
            const isBase64 = this.isValidBase64(content);
            return {
                format: isBase64 ? 'base64' : 'text',
                size: content.length,
                isValid: isBase64,
                encoding: isBase64 ? 'base64' : 'utf8'
            };
        }

        // Check if content is binary data
        if (content instanceof ArrayBuffer || content instanceof Uint8Array || Buffer.isBuffer(content)) {
            return {
                format: 'binary',
                size: content instanceof ArrayBuffer ? content.byteLength : content.length,
                isValid: true,
                encoding: 'binary'
            };
        }

        return {
            format: 'unknown',
            size: 0,
            isValid: false
        };
    }

    /**
     * Validate if a string is valid base64
     */
    static isValidBase64(str: string): boolean {
        if (!str || typeof str !== 'string') {
            return false;
        }

        // Remove whitespace and check basic format
        const cleanStr = str.replace(/\s/g, '');
        
        // Check if it contains only valid base64 characters
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(cleanStr)) {
            return false;
        }

        // Check if length is valid (must be multiple of 4)
        if (cleanStr.length % 4 !== 0) {
            return false;
        }

        // Try to decode to verify it's valid
        try {
            atob(cleanStr);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Safely decode base64 string with error handling
     */
    static safeDecodeBase64(base64String: string): ArrayBuffer | null {
        try {
            // Clean the base64 string
            const cleanBase64 = base64String.replace(/\s/g, '');
            
            if (!this.isValidBase64(cleanBase64)) {
                console.warn('Invalid base64 string provided');
                return null;
            }

            // Decode base64 to binary string
            const binaryString = atob(cleanBase64);
            
            // Convert to ArrayBuffer
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            return bytes.buffer;
        } catch (error) {
            console.error('Error decoding base64:', error);
            return null;
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    static arrayBufferToBase64(buffer: ArrayBuffer): string {
        try {
            const bytes = new Uint8Array(buffer);
            const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
            return btoa(binaryString);
        } catch (error) {
            console.error('Error converting ArrayBuffer to base64:', error);
            throw new Error('Failed to convert binary data to base64');
        }
    }

    /**
     * Process attachment content to get ArrayBuffer safely
     */
    static async processAttachmentContent(attachment: Attachment): Promise<ProcessedAttachmentData> {
        const info = this.analyzeAttachmentData(attachment);
        
        console.log(`[AttachmentDataProcessor] Processing attachment: ${attachment.filename}`, {
            format: info.format,
            size: info.size,
            isValid: info.isValid,
            contentType: attachment.contentType
        });

        let arrayBuffer: ArrayBuffer;
        let base64: string;

        try {
            switch (info.format) {
                case 'dataurl':
                    // Extract base64 data from data URL
                    if (typeof attachment.content === 'string') {
                        const dataUrlMatch = attachment.content.match(/^data:[^;]+;base64,(.+)$/);
                        if (dataUrlMatch && dataUrlMatch[1]) {
                            const base64Data = dataUrlMatch[1];
                            const decoded = this.safeDecodeBase64(base64Data);
                            if (decoded) {
                                arrayBuffer = decoded;
                                base64 = base64Data;
                                break;
                            }
                        }
                    }
                    throw new Error('Invalid data URL format');

                case 'base64':
                    // Direct base64 content
                    if (typeof attachment.content === 'string') {
                        const decoded = this.safeDecodeBase64(attachment.content);
                        if (decoded) {
                            arrayBuffer = decoded;
                            base64 = attachment.content;
                            break;
                        }
                    }
                    throw new Error('Invalid base64 content');

                case 'binary':
                    // Binary content (ArrayBuffer, Uint8Array, Buffer)
                    if (attachment.content instanceof ArrayBuffer) {
                        arrayBuffer = attachment.content;
                    } else if (attachment.content instanceof Uint8Array) {
                        arrayBuffer = attachment.content.buffer.slice(
                            attachment.content.byteOffset,
                            attachment.content.byteOffset + attachment.content.byteLength
                        );
                    } else if (Buffer.isBuffer(attachment.content)) {
                        arrayBuffer = attachment.content.buffer.slice(
                            attachment.content.byteOffset,
                            attachment.content.byteOffset + attachment.content.byteLength
                        );
                    } else {
                        throw new Error('Unsupported binary format');
                    }
                    
                    base64 = this.arrayBufferToBase64(arrayBuffer);
                    break;

                case 'text':
                    // Text content (encode as UTF-8)
                    if (typeof attachment.content === 'string') {
                        const encoder = new TextEncoder();
                        const utf8Bytes = encoder.encode(attachment.content);
                        arrayBuffer = utf8Bytes.buffer;
                        base64 = this.arrayBufferToBase64(arrayBuffer);
                        break;
                    }
                    throw new Error('Invalid text content');

                default:
                    throw new Error(`Unsupported content format: ${info.format}`);
            }

            // Create data URL
            const mimeType = attachment.contentType || 'application/octet-stream';
            const dataUrl = `data:${mimeType};base64,${base64}`;

            console.log(`[AttachmentDataProcessor] Successfully processed attachment: ${attachment.filename}`, {
                originalFormat: info.format,
                outputSize: arrayBuffer.byteLength,
                mimeType
            });

            return {
                arrayBuffer,
                dataUrl,
                base64,
                info
            };

        } catch (error) {
            console.error(`[AttachmentDataProcessor] Error processing attachment: ${attachment.filename}`, error);
            throw new Error(`Failed to process attachment data: ${(error as Error).message}`);
        }
    }

    /**
     * Create a safe data URL for attachment
     */
    static async createSafeDataURL(attachment: Attachment): Promise<string> {
        try {
            const processed = await this.processAttachmentContent(attachment);
            return processed.dataUrl;
        } catch (error) {
            console.error('Error creating safe data URL:', error);
            throw error;
        }
    }

    /**
     * Get ArrayBuffer from attachment safely
     */
    static async getArrayBuffer(attachment: Attachment): Promise<ArrayBuffer> {
        try {
            const processed = await this.processAttachmentContent(attachment);
            return processed.arrayBuffer;
        } catch (error) {
            console.error('Error getting ArrayBuffer:', error);
            throw error;
        }
    }

    /**
     * Validate attachment data integrity
     */
    static validateAttachment(attachment: Attachment): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!attachment) {
            errors.push('Attachment object is null or undefined');
            return { isValid: false, errors };
        }

        if (!attachment.content) {
            errors.push('Attachment has no content');
        }

        if (!attachment.contentType) {
            errors.push('Attachment has no content type');
        }

        if (!attachment.filename && !attachment.name) {
            errors.push('Attachment has no filename');
        }

        const info = this.analyzeAttachmentData(attachment);
        if (!info.isValid) {
            errors.push(`Attachment content format is invalid: ${info.format}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Debug attachment data format
     */
    static debugAttachmentData(attachment: Attachment): void {
        const info = this.analyzeAttachmentData(attachment);
        const validation = this.validateAttachment(attachment);

        console.group(`[AttachmentDataProcessor] Debug: ${attachment.filename || 'Unknown'}`);
        console.log('Content Info:', info);
        console.log('Validation:', validation);
        
        if (attachment.content) {
            console.log('Content Sample:', {
                type: typeof attachment.content,
                length: attachment.content instanceof ArrayBuffer ? attachment.content.byteLength : 
                       typeof attachment.content === 'string' ? attachment.content.length : 'unknown',
                sample: typeof attachment.content === 'string' ? 
                       attachment.content.substring(0, 100) + '...' : 'Binary data'
            });
        }
        
        console.groupEnd();
    }
}

export default AttachmentDataProcessor; 