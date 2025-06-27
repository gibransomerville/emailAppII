// UI component and interaction type definitions for TypeScript migration

/**
 * Theme types
 */
export type Theme = 'light' | 'dark' | 'auto';

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
  timestamp: string;
  persistent?: boolean;
  actions?: NotificationAction[];
}

/**
 * Notification action
 */
export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Modal configuration
 */
export interface ModalConfig {
  id: string;
  title: string;
  content?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closable?: boolean;
  backdrop?: boolean;
  keyboard?: boolean;
  
  // Actions
  actions?: ModalAction[];
  onShow?: () => void;
  onHide?: () => void;
}

/**
 * Modal action
 */
export interface ModalAction {
  label: string;
  action: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Search UI state
 */
export interface SearchUIState {
  query: string;
  isActive: boolean;
  isLoading: boolean;
  results: SearchResult[];
  resultCount: number;
  searchTime: number;
  hasMore: boolean;
  error?: string;
}

/**
 * Search result interface
 */
export interface SearchResult {
  emailId: string;
  email: import('./email').Email;
  score: number;
  highlights: SearchHighlight[];
  snippet: string;
  matchedFields: string[];
}

/**
 * Search highlight
 */
export interface SearchHighlight {
  field: string;
  text: string;
  matches: HighlightMatch[];
}

/**
 * Highlight match
 */
export interface HighlightMatch {
  start: number;
  end: number;
  text: string;
}

/**
 * Conversation element data
 */
export interface ConversationElement {
  id: string;
  conversation: import('./email').EmailConversation;
  element: HTMLElement;
  isSelected: boolean;
  isActive: boolean;
  lastUpdate: string;
}

/**
 * Email display format
 */
export type EmailDisplayFormat = 'expanded' | 'collapsed' | 'preview' | 'compact';

/**
 * Rendering options
 */
export interface RenderingOptions {
  format: EmailDisplayFormat;
  showMetadata: boolean;
  showAttachments: boolean;
  enableInteraction: boolean;
  highlightTerms?: string[];
  maxContentLength?: number;
  
  // Security options
  allowExternalImages: boolean;
  allowExternalLinks: boolean;
  sanitizeContent: boolean;
}

/**
 * UI state interface
 */
export interface UIState {
  // Theme and appearance
  theme: Theme;
  compactMode: boolean;
  sidebarCollapsed: boolean;
  
  // Active elements
  activeConversation?: string;
  selectedEmails: string[];
  
  // Modal states
  modals: {
    compose: boolean;
    settings: boolean;
    oauthLoading: boolean;
  };
  
  // Loading states
  loading: {
    emails: boolean;
    search: boolean;
    sending: boolean;
    authentication: boolean;
  };
  
  // Search state
  search: SearchUIState;
  
  // Notifications
  notifications: Notification[];
}

/**
 * Event handler types
 */
export type EventHandler<T = Event> = (event: T) => void | Promise<void>;

/**
 * Keyboard shortcut
 */
export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'cmd' | 'alt' | 'shift')[];
  action: () => void;
  description: string;
  context?: 'global' | 'compose' | 'conversation' | 'search';
}

/**
 * Form validation result
 */
export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings?: Record<string, string>;
}

/**
 * Form field configuration
 */
export interface FormFieldConfig {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: (value: any) => string | null;
  options?: { value: string; label: string }[];
  disabled?: boolean;
  readonly?: boolean;
}

/**
 * Button configuration
 */
export interface ButtonConfig {
  id: string;
  label: string;
  icon?: string;
  style?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  onClick: EventHandler<MouseEvent>;
}

/**
 * Context menu item
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  onClick?: () => void;
}

/**
 * Toast configuration
 */
export interface ToastConfig {
  message: string;
  type: NotificationType;
  duration?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  closable?: boolean;
  actions?: ToastAction[];
}

/**
 * Toast action
 */
export interface ToastAction {
  label: string;
  action: () => void;
}

/**
 * Loading state
 */
export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
  cancellable?: boolean;
  onCancel?: () => void;
}

/**
 * Drag and drop data
 */
export interface DragDropData {
  type: 'email' | 'attachment' | 'file';
  data: any;
  source: HTMLElement;
  target?: HTMLElement;
}

/**
 * Virtual scroll item
 */
export interface VirtualScrollItem {
  id: string;
  height: number;
  data: any;
  rendered: boolean;
  element?: HTMLElement;
}

/**
 * Virtual scroll configuration
 */
export interface VirtualScrollConfig {
  itemHeight: number;
  bufferSize: number;
  overscan: number;
  estimateSize?: (index: number) => number;
  renderItem: (item: VirtualScrollItem, index: number) => HTMLElement;
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  fill?: 'none' | 'forwards' | 'backwards' | 'both';
}

/**
 * Responsive breakpoints
 */
export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
  wide: number;
}

/**
 * Component props base interface
 */
export interface ComponentProps {
  id?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  children?: HTMLElement | HTMLElement[] | string;
  onClick?: EventHandler<MouseEvent>;
  onFocus?: EventHandler<FocusEvent>;
  onBlur?: EventHandler<FocusEvent>;
}

/**
 * Email list item props
 */
export interface EmailListItemProps extends ComponentProps {
  email: import('./email').Email;
  isSelected: boolean;
  isRead: boolean;
  showPreview: boolean;
  highlightTerms?: string[];
  onSelect: (emailId: string) => void;
  onToggleRead: (emailId: string) => void;
}

/**
 * Conversation list item props
 */
export interface ConversationListItemProps extends ComponentProps {
  conversation: import('./email').EmailConversation;
  isActive: boolean;
  isSelected: boolean;
  showPreview: boolean;
  highlightTerms?: string[];
  onSelect: (conversationId: string) => void;
}

/**
 * Search input props
 */
export interface SearchInputProps extends ComponentProps {
  value: string;
  placeholder?: string;
  debounceMs?: number;
  onSearch: (query: string) => void;
  onClear: () => void;
  loading?: boolean;
}

/**
 * Attachment preview props
 */
export interface AttachmentPreviewProps extends ComponentProps {
  attachment: import('./email').Attachment;
  showPreview: boolean;
  onDownload: (attachment: import('./email').Attachment) => void;
  onPreview: (attachment: import('./email').Attachment) => void;
}

/**
 * DOM element cache
 */
export interface DOMElementCache {
  // Modals
  composeModal?: HTMLElement;
  settingsModal?: HTMLElement;
  oauthLoadingModal?: HTMLElement;
  
  // Main containers
  conversationsList?: HTMLElement;
  messagesContainer?: HTMLElement;
  
  // Input elements
  searchInput?: HTMLInputElement;
  composeForm?: HTMLFormElement;
  toInput?: HTMLInputElement;
  ccInput?: HTMLInputElement;
  subjectInput?: HTMLInputElement;
  bodyInput?: HTMLTextAreaElement;
  
  // Buttons
  composeBtn?: HTMLButtonElement;
  settingsBtn?: HTMLButtonElement;
  refreshBtn?: HTMLButtonElement;
  sendBtn?: HTMLButtonElement;
  
  // Loading and progress
  loadingOverlay?: HTMLElement;
  oauthProgressFill?: HTMLElement;
  oauthProgressText?: HTMLElement;
  oauthProviderIcon?: HTMLElement;
  oauthLoadingTitle?: HTMLElement;
}

/**
 * SafeHTML and sanitization types
 */
export type SanitizationMode = 'email' | 'ui' | 'strict';

export interface SafeHTMLOptions {
  mode?: SanitizationMode;
  allowedTags?: string[];
  allowedAttributes?: string[];
  forbiddenTags?: string[];
  forbiddenAttributes?: string[];
  stripIgnoreTag?: boolean;
  stripIgnoreTagBody?: boolean;
}

export interface SafeHTMLTemplateData {
  [key: string]: string | number | boolean;
}

export interface SafeHTMLValidationResult {
  isValid: boolean;
  missingDependencies: string[];
  errors: string[];
}

/**
 * DOMPurify type declarations
 */
declare global {
  interface Window {
    DOMPurify: DOMPurifyAPI;
    SafeHTML: SafeHTMLAPI;
  }

  interface DOMPurifyAPI {
    sanitize(dirty: string, config?: DOMPurifyConfig): string;
    addHook(entryPoint: string, hookFunction: Function): void;
    removeHook(entryPoint: string): void;
    removeHooks(entryPoint: string): void;
    removeAllHooks(): void;
    isValidAttribute(tag: string, attr: string, value: string): boolean;
  }

  interface DOMPurifyConfig {
    ALLOWED_TAGS?: string[];
    ALLOWED_ATTR?: string[];
    ALLOWED_URI_REGEXP?: RegExp;
    FORBID_TAGS?: string[];
    FORBID_ATTR?: string[];
    FORBID_CONTENTS?: string[];
    KEEP_CONTENT?: boolean;
    IN_PLACE?: boolean;
    RETURN_DOM?: boolean;
    RETURN_DOM_FRAGMENT?: boolean;
    RETURN_DOM_IMPORT?: boolean;
    SANITIZE_DOM?: boolean;
    ADD_TAGS?: string[];
    ADD_ATTR?: string[];
    WHOLE_DOCUMENT?: boolean;
    FORCE_BODY?: boolean;
  }

  interface SafeHTMLAPI {
    sanitizeEmail(html: string, options?: SafeHTMLOptions): string;
    sanitizeUI(html: string, options?: SafeHTMLOptions): string;
    sanitizeStrict(html: string, options?: SafeHTMLOptions): string;
    setInnerHTML(element: HTMLElement, html: string, mode?: SanitizationMode): void;
    escapeHtml(text: string): string;
    template(template: string, data?: SafeHTMLTemplateData, mode?: SanitizationMode): string;
    validateDependencies(): SafeHTMLValidationResult;
    initialize(): boolean;
  }
} 