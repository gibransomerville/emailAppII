// Configuration-related type definitions for TypeScript migration

/**
 * Email configuration interface
 */
export interface EmailConfig {
  // Basic email settings
  email: string;
  password: string;
  
  // SMTP settings
  smtpHost: string;
  smtpPort: number;
  smtpSecure?: boolean;
  smtpAuth?: {
    user: string;
    pass: string;
  };
  
  // IMAP settings
  imapHost: string;
  imapPort: number;
  imapSecure?: boolean;
  imapAuth?: {
    user: string;
    pass: string;
  };
  
  // Additional settings
  displayName?: string;
  signature?: string;
  autoReply?: boolean;
  
  // OAuth settings
  useOAuth?: boolean;
  oauthProvider?: 'google' | 'microsoft';
}

/**
 * Email parsing configuration
 */
export interface EmailParsingConfig {
  // Parser preferences
  useMailparser: boolean;
  fallbackToManual: boolean;
  debugParsing: boolean;
  
  // Content processing
  maxContentLength: number;
  stripHtmlForPreview: boolean;
  preserveOriginalHtml: boolean;
  
  // Attachment handling
  maxAttachmentSize: number;
  allowedAttachmentTypes: string[];
  inlineImageHandling: 'embed' | 'link' | 'remove';
  
  // Threading
  enableThreading: boolean;
  threadingAlgorithm: 'references' | 'subject' | 'hybrid';
  maxThreadDepth: number;
  
  // Performance
  batchSize: number;
  concurrentParsing: boolean;
  cacheResults: boolean;
}

/**
 * DOMPurify configuration
 */
export interface DOMPurifyConfig {
  // Email sanitization settings
  ALLOWED_TAGS: string[];
  ALLOWED_ATTR: string[];
  ALLOWED_URI_REGEXP: RegExp;
  
  // Security settings
  FORBID_TAGS: string[];
  FORBID_ATTR: string[];
  FORBID_CONTENTS: string[];
  
  // Additional options
  KEEP_CONTENT: boolean;
  IN_PLACE: boolean;
  RETURN_DOM: boolean;
  RETURN_DOM_FRAGMENT: boolean;
  RETURN_DOM_IMPORT: boolean;
  SANITIZE_DOM: boolean;
  
  // Custom configurations for different contexts
  email?: Partial<DOMPurifyConfig>;
  ui?: Partial<DOMPurifyConfig>;
  strict?: Partial<DOMPurifyConfig>;
}

/**
 * Application configuration
 */
export interface AppConfig {
  // Application metadata
  name: string;
  version: string;
  description?: string;
  
  // Window settings
  window: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    resizable?: boolean;
    maximizable?: boolean;
    minimizable?: boolean;
  };
  
  // Development settings
  isDevelopment: boolean;
  enableDevTools: boolean;
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  // Feature flags
  features: {
    enableSearch: boolean;
    enableThreading: boolean;
    enableAttachments: boolean;
    enableOAuth: boolean;
    enableDrafts: boolean;
    enableNotifications: boolean;
  };
  
  // Performance settings
  performance: {
    emailBatchSize: number;
    searchDebounceMs: number;
    autoSaveIntervalMs: number;
    cacheSize: number;
  };
  
  // UI settings
  ui: {
    defaultTheme: 'light' | 'dark' | 'auto';
    animationsEnabled: boolean;
    compactMode: boolean;
    showPreviewPane: boolean;
  };
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  redirectUri: string;
  callbackPort: number;
  accessType: 'online' | 'offline';
  prompt?: 'none' | 'consent' | 'select_account';
  
  // Security settings
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

/**
 * OAuth configuration for all providers
 */
export interface OAuthConfig {
  google: OAuthProviderConfig;
  microsoft: OAuthProviderConfig;
}

/**
 * Google OAuth token
 */
export interface GoogleAuthToken {
  access_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number;
  expires_at?: number;
  scope: string;
  
  // Additional Google-specific fields
  id_token?: string;
}

/**
 * Microsoft OAuth token
 */
export interface MicrosoftAuthToken {
  access_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number;
  expires_at?: number;
  scope: string;
  
  // Additional Microsoft-specific fields
  id_token?: string;
  account?: {
    homeAccountId: string;
    environment: string;
    tenantId: string;
    username: string;
  };
}

/**
 * Search configuration interfaces
 */
export interface SearchEngineConfig {
  DEBOUNCE_DELAY: number;
  MAX_HISTORY_SIZE: number;
  MAX_SUGGESTIONS: number;
  INDEX_BATCH_SIZE: number;
}

export interface SearchOperators {
  FROM: string;
  TO: string;
  SUBJECT: string;
  HAS_ATTACHMENT: string;
  AFTER: string;
  BEFORE: string;
}

export interface SearchScoringConfig {
  SUBJECT_MATCH: number;
  PARTICIPANT_MATCH: number;
  BODY_MATCH: number;
  ATTACHMENT_MATCH: number;
}

export interface IMAPSearchConfig {
  SUPPORTED: string[];
  OPERATOR_MAPPING: Record<string, string>;
}

export interface SearchUIConfig {
  SEARCH_RESULT_CLASSES: {
    CONTAINER: string;
    HIGHLIGHT: string;
    MATCH_COUNT: string;
    RESULT_BADGE: string;
    NO_RESULTS: string;
    SEARCH_TIPS: string;
  };
  SEARCH_TIPS: string[];
}

export interface SearchPerformanceConfig {
  MIN_WORD_LENGTH: number;
  MAX_WORD_LENGTH: number;
  INDEX_UPDATE_THRESHOLD: number;
  SEARCH_TIMEOUT: number;
  IMAP_SEARCH_TIMEOUT: number;
}

export interface SearchFeaturesConfig {
  ENABLE_IMAP_SEARCH: boolean;
  ENABLE_SEARCH_SUGGESTIONS: boolean;
  ENABLE_SEARCH_HISTORY: boolean;
  ENABLE_FUZZY_SEARCH: boolean;
  ENABLE_SEARCH_ANALYTICS: boolean;
}

export interface SearchConfigComplete {
  ENGINE: SearchEngineConfig;
  OPERATORS: SearchOperators;
  SCORING: SearchScoringConfig;
  STOP_WORDS: string[];
  IMAP_CRITERIA: IMAPSearchConfig;
  UI: SearchUIConfig;
  PERFORMANCE: SearchPerformanceConfig;
  FEATURES: SearchFeaturesConfig;
}

/**
 * Search utility interfaces
 */
export interface SearchValidationResult {
  valid: boolean;
  error?: string;
}

export interface SearchStats {
  totalEmails: number;
  uniqueWords: number;
  participants: number;
  subjects: number;
  datesIndexed: number;
  attachments: number;
  lastIndexUpdate: Date | null;
  searchHistorySize: number;
}

export interface SearchResult {
  results: string[];
  query: string;
  totalResults: number;
  searchTime: number;
  searchType: 'local' | 'imap' | 'hybrid' | 'advanced' | 'simple' | 'empty';
  parsedQuery?: ParsedQuery;
}

export interface IndexStats {
  totalEmails: number;
  lastUpdated: Date;
  indexSize: number;
}

/**
 * Search configuration (legacy interface)
 */
export interface SearchConfig {
  // Search engine settings
  enableFullTextSearch: boolean;
  enableIMAPSearch: boolean;
  searchProviders: ('local' | 'imap')[];
  
  // Indexing settings
  buildIndexOnStartup: boolean;
  indexBatchSize: number;
  maxIndexSize: number;
  
  // Search behavior
  minQueryLength: number;
  maxResults: number;
  searchTimeout: number;
  debounceMs: number;
  
  // Search operators
  enableAdvancedOperators: boolean;
  supportedOperators: string[];
  
  // Result formatting
  highlightMatches: boolean;
  highlightClass: string;
  contextLength: number;
}

/**
 * IMAP configuration
 */
export interface IMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  
  // Connection settings
  connTimeout?: number;
  authTimeout?: number;
  keepalive?: boolean;
  
  // TLS settings
  tls?: {
    rejectUnauthorized?: boolean;
    servername?: string;
  };
  
  // Folder settings
  defaultFolder: string;
  supportedFolders: string[];
  
  // Additional fields for search engine
  email?: string;
  password?: string;
  imapHost?: string;
  imapPort?: number;
}

/**
 * SMTP configuration
 */
export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  
  // Connection settings
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
  
  // TLS settings
  tls?: {
    rejectUnauthorized?: boolean;
    servername?: string;
  };
  
  // Additional settings
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

/**
 * Settings form data
 */
export interface SettingsFormData {
  // Email configuration
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: string;
  imapHost: string;
  imapPort: string;
  
  // UI preferences
  theme: 'light' | 'dark';
  compactMode: boolean;
  showPreviewPane: boolean;
  
  // Notification preferences
  enableNotifications: boolean;
  soundEnabled: boolean;
  
  // Advanced settings
  enableDebugMode: boolean;
  autoSaveInterval: string;
  emailBatchSize: string;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  field?: string;
}

/**
 * Configuration save result
 */
export interface ConfigSaveResult {
  success: boolean;
  error?: string;
  config?: EmailConfig;
  timestamp: string;
}

/**
 * Additional search-related interfaces for search-engine.ts
 */
export interface SearchQuery {
  query: string;
  options?: SearchOptions;
}

export interface SearchOptions {
  folder?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'relevance' | 'sender';
  sortOrder?: 'asc' | 'desc';
  useIMAP?: boolean;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: Date;
  resultCount: number;
}

export interface SearchSuggestion {
  type: 'history' | 'participant' | 'subject' | 'operator';
  text: string;
  count?: number;
  resultCount?: number;
}

export interface ParsedQuery {
  terms: string[];
  from: string[];
  to: string[];
  subject: string[];
  hasAttachment: boolean;
  dateRange: DateRange | null;
  isAdvanced: boolean;
}

export interface DateRange {
  after?: string;
  before?: string;
}

export interface SearchableContent {
  subject: string;
  from: string;
  to: string;
  cc: string;
  body: string;
  htmlBody: string;
  attachmentNames: string;
  allText: string;
}

export type IMAPSearchCriteria = [string, string | Date | number] | [string]; 