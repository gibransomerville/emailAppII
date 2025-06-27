// Global type definitions for Electron Email Client

declare global {
  // Electron IPC Renderer
  interface Window {
    // Electron APIs
    require: NodeRequire;
    
    // Email Application Globals
    EmailRenderer?: any;
    EmailManager?: any;
    AuthManager?: any;
    UIThemeManager?: any;
    EventManager?: any;
    IMAPEmailManager?: any;
    EmailComposer?: any;
    SettingsManager?: any;
    AttachmentHandler?: any;
    SafeHTML?: any;
    ThreadingManager?: any;
    SearchManager?: any;
    SearchUtils?: any;
    
    // Global instances
    emailRenderer?: any;
    emailManager?: any;
    authManager?: any;
    uiThemeManager?: any;
    eventManager?: any;
    imapEmailManager?: any;
    emailComposer?: any;
    settingsManager?: any;
    
    // Global configuration objects
    EMAIL_PARSING_CONFIG?: any;
    DOMPURIFY_CONFIG?: any;
    APP_CONFIG?: any;
    
    // Global functions
    loadEmails?: () => Promise<void>;
    sendEmail?: () => Promise<void>;
    sendMessage?: () => Promise<void>;
    showSettingsModal?: () => void;
    hideSettingsModal?: () => void;
    showComposeModal?: () => void;
    hideComposeModal?: () => void;
    showNotification?: (message: string, type: string) => void;
    switchTheme?: (theme: string) => void;
    setupEventListeners?: () => void;
    
    // Test functions
    testSearchFunctionality?: () => any;
    testEmailThreading?: () => any;
    testSafeHTMLRendering?: () => any;
    debugEmailRenderingIssues?: () => void;
    debugConversation?: (conversationId: string) => void;
    testConversationDisplay?: (conversationId: string) => void;
    
    // Google APIs
    gapi?: {
      client?: {
        gmail?: any;
      };
    };
    
    // DOMPurify
    DOMPurify?: any;
  }
  
  // Node.js globals in renderer process
  var require: NodeRequire;
  var process: NodeJS.Process;
  var global: NodeJS.Global;
  var __filename: string;
  var __dirname: string;
  var Buffer: BufferConstructor;
}

// Electron main process types
declare module 'electron' {
  interface IpcMain {
    handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => any): void;
  }
  
  interface IpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void;
  }
}

export {}; 