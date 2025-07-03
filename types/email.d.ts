// Email-related type definitions for TypeScript migration

/**
 * Core email interfaces
 */
export interface Email {
  // Unique identifiers
  id: string;
  messageId: string;
  threadId?: string;
  conversationId?: string;
  date: string;
  timestamp?: number;
  
  // Content
  subject: string;
  body: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet?: string;
  isHtml?: boolean;
  
  // Participants
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  
  // Metadata
  read?: boolean;
  unread?: boolean;
  labels?: string[];
  folder?: string;
  source?: EmailSource;
  headers?: Record<string, any>;
  
  // Attachments
  attachments?: EmailAttachment[];
  hasAttachments?: boolean;
  error?: string;
}

/**
 * Email attachment interface
 */
export interface Attachment {
  name: string;
  filename: string;
  url: string;
  contentType: string;
  contentTypeParam?: string;
  size: number;
  isInline: boolean;
  isTemporary: boolean;
  cloudInfo?: {
    provider: string;
    accountKey: string;
    partHeaderData: string;
  };
  contentId?: string;
  charset?: string;
  macType?: string;
  macCreator?: string;
  description?: string;
  disposition?: string;
  msgUri?: string;
  urlCharset?: string;
  content?: Buffer | string;
  encoding?: string;
  attachmentId?: string;
  messageId?: string;
}

// Use Attachment as the canonical type for all attachments
export type EmailAttachment = Attachment;

/**
 * Attachment handling types
 */
export type FileTypeCategory = 'image' | 'text' | 'pdf' | 'video' | 'audio' | 'document' | 'archive' | 'unknown';

export interface AttachmentPreviewOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface AttachmentDownloadOptions {
  filename?: string;
  saveAs?: boolean;
  openAfterDownload?: boolean;
}

export interface AttachmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileType: FileTypeCategory;
  isPreviewable: boolean;
  isSafe: boolean;
}

export interface AttachmentProcessingResult {
  success: boolean;
  attachment?: EmailAttachment;
  error?: string;
  dataUrl?: string;
  previewElement?: HTMLElement;
}

/**
 * Attachment handler interfaces
 */
export interface AttachmentHandlerConfig {
  maxFileSize: number;
  allowedTypes: string[];
  previewableTypes: Record<FileTypeCategory, string[]>;
  enablePreview: boolean;
  enableDownload: boolean;
  sanitizeContent: boolean;
}

export interface AttachmentModalConfig {
  title?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  allowDownload?: boolean;
  allowFullscreen?: boolean;
  maxWidth?: string;
  maxHeight?: string;
}

/**
 * Email conversation and threading
 */
export interface EmailConversation {
  id: string;
  subject: string;
  participants: string[];
  emails: Email[];
  unreadCount: number;
  hasAttachments: boolean;
}

/**
 * Email source tracking
 */
export type EmailSource = 'imap' | 'gmail-api' | 'outlook-api' | 'local' | 'import';

/**
 * Email parsing and processing
 */
export interface EmailParsingResult {
  success: boolean;
  email?: Email;
  error?: string;
  warnings?: string[];
  attachments?: EmailAttachment[];
  processingTime?: number;
}

export interface EmailStats {
  totalEmails: number;
  unreadCount: number;
  attachmentCount: number;
  totalSize: number;
  oldestEmail?: Date;
  newestEmail?: Date;
  topSenders: Array<{ email: string; count: number }>;
  folderStats: Record<string, number>;
}

/**
 * Email address and participant handling
 */
export interface EmailAddress {
  name?: string;
  email: string;
}

/**
 * Email actions and operations
 */
export type EmailAction = 
  | 'mark-read' 
  | 'mark-unread' 
  | 'star' 
  | 'unstar' 
  | 'delete' 
  | 'archive' 
  | 'move' 
  | 'copy' 
  | 'reply' 
  | 'reply-all' 
  | 'forward';

export interface EmailActionResult {
  success: boolean;
  action: EmailAction;
  emailIds: string[];
  error?: string;
  affectedCount?: number;
}

/**
 * Email composition and sending
 */
export interface EmailComposition {
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyType: 'text' | 'html';
  attachments?: EmailAttachment[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  priority?: 'low' | 'normal' | 'high';
  requestReadReceipt?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt?: Date;
  recipients?: {
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
  };
}

/**
 * Email drafts
 */
export interface EmailDraft extends EmailComposition {
  id?: string;
  createdAt: Date;
  modifiedAt: Date;
  autoSaved: boolean;
  version: number;
}

/**
 * Email threading
 */
export interface EmailThread {
  id: string;
  subject: string;
  emails: Email[];
  participants: EmailAddress[];
  startDate: Date;
  lastActivity: Date;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
  labels?: string[];
  folder: string;
}

export interface ThreadingStats {
  totalThreads: number;
  averageThreadLength: number;
  longestThread: number;
  threadsWithAttachments: number;
  recentActivity: Date;
}

export interface EmailLoadingResult {
  success: boolean;
  emails: Email[];
  conversations: Record<string, EmailConversation>;
  error?: string;
  stats?: {
    totalEmails: number;
    totalConversations: number;
    loadingTime: number;
  };
}

export interface GmailAPI {
  users: {
    messages: {
      list: (params: {
        userId: string;
        labelIds?: string[];
        maxResults?: number;
      }) => Promise<{
        data: {
          messages?: { id: string; threadId?: string }[];
          nextPageToken?: string;
        };
      }>;
      get: (params: {
        userId: string;
        id: string;
        format?: string;
      }) => Promise<{
        data: {
          id: string;
          threadId?: string;
          labelIds?: string[];
          snippet?: string;
          payload?: any;
          raw?: string;
        };
      }>;
    };
  };
} 