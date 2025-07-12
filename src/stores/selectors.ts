// src/stores/selectors.ts
import type { Email, EmailConversation } from '../../types/email.js';
import type { useAuthStore } from './authStore.js';
import type { useEmailStore } from './emailStore.js';
import type { useUIStore } from './uiStore.js';
import type { useSearchStore } from './searchStore.js';
import type { useSettingsStore } from './settingsStore.js';

// Import interface types to fix linter errors
import type { EmailSettings, UISettings, SecuritySettings } from './settingsStore.js';

// Type helpers
type AuthState = ReturnType<typeof useAuthStore.getState>;
type EmailState = ReturnType<typeof useEmailStore.getState>;
type UIState = ReturnType<typeof useUIStore.getState>;
type SearchState = ReturnType<typeof useSearchStore.getState>;
type SettingsState = ReturnType<typeof useSettingsStore.getState>;

// Auth Store Selectors
export const selectAuthToken = (state: AuthState) => state.token;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectAuthLoading = (state: AuthState) => state.loading;
export const selectAuthError = (state: AuthState) => state.error;
export const selectLastLoginTime = (state: AuthState) => state.lastLoginTime;
export const selectIsTokenValid = (state: AuthState) => state.validateToken();

// Email Store Selectors
export const selectAllEmails = (state: EmailState) => state.emails;
export const selectEmailCount = (state: EmailState) => state.emails.length;
export const selectUnreadEmails = (state: EmailState) => state.emails.filter(email => !email.read);
export const selectUnreadCount = (state: EmailState) => state.emails.filter(email => !email.read).length;
export const selectReadEmails = (state: EmailState) => state.emails.filter(email => email.read);
export const selectSelectedConversation = (state: EmailState) => state.selectedConversation;
export const selectAllConversations = (state: EmailState) => state.conversations;
export const selectConversationCount = (state: EmailState) => Object.keys(state.conversations).length;
export const selectEmailLoading = (state: EmailState) => state.loading;
export const selectEmailError = (state: EmailState) => state.error;
export const selectLastUpdated = (state: EmailState) => state.lastUpdated;

// Email by ID selector (memoized)
export const selectEmailById = (id: string) => (state: EmailState) => 
  state.emails.find(email => email.id === id);

// Email by conversation selector
export const selectEmailsByConversation = (conversationId: string) => (state: EmailState) => {
  const conversation = state.conversations[conversationId];
  if (!conversation) return [];
  return conversation.emails || [];
};

// Conversation by ID selector
export const selectConversationById = (id: string) => (state: EmailState) => 
  state.conversations[id];

// Emails with attachments selector
export const selectEmailsWithAttachments = (state: EmailState) => 
  state.emails.filter(email => email.attachments && email.attachments.length > 0);

// Recent emails selector (last 7 days)
export const selectRecentEmails = (state: EmailState) => {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return state.emails.filter(email => {
    const emailDate = new Date(email.date).getTime();
    return emailDate > sevenDaysAgo;
  });
};

// UI Store Selectors
export const selectTheme = (state: UIState) => state.theme;
export const selectIsDarkTheme = (state: UIState) => state.theme === 'dark';
export const selectModals = (state: UIState) => state.modals;
export const selectModalState = (modalType: keyof UIState['modals']) => (state: UIState) => 
  state.modals[modalType];
export const selectNotifications = (state: UIState) => state.notifications;
export const selectNotificationCount = (state: UIState) => state.notifications.length;
export const selectUILoading = (state: UIState) => state.loading;
export const selectSidebarCollapsed = (state: UIState) => state.sidebarCollapsed;

// Recent notifications selector (last 5)
export const selectRecentNotifications = (state: UIState) => 
  state.notifications.slice(0, 5);

// Notifications by type selector
export const selectNotificationsByType = (type: UIState['notifications'][0]['type']) => (state: UIState) => 
  state.notifications.filter(notification => notification.type === type);

// Search Store Selectors
export const selectSearchQuery = (state: SearchState) => state.query;
export const selectSearchResults = (state: SearchState) => state.results;
export const selectSearchResultCount = (state: SearchState) => state.results.length;
export const selectSearchLoading = (state: SearchState) => state.loading;
export const selectSearchError = (state: SearchState) => state.error;
export const selectSearchFilters = (state: SearchState) => state.filters;
export const selectIsSearchActive = (state: SearchState) => state.query.trim().length > 0;

// Settings Store Selectors
export const selectEmailSettings = (state: SettingsState): EmailSettings => state.email;
export const selectUISettings = (state: SettingsState): UISettings => state.ui;
export const selectSecuritySettings = (state: SettingsState): SecuritySettings => state.security;

// Specific settings selectors
export const selectAutoRefresh = (state: SettingsState) => state.email.autoRefresh;
export const selectRefreshInterval = (state: SettingsState) => state.email.refreshInterval;
export const selectMaxEmailsPerPage = (state: SettingsState) => state.email.maxEmailsPerPage;
export const selectShowPreview = (state: SettingsState) => state.email.showPreview;
export const selectMarkAsReadOnOpen = (state: SettingsState) => state.email.markAsReadOnOpen;
export const selectDownloadAttachments = (state: SettingsState) => state.email.downloadAttachments;
export const selectMaxAttachmentSize = (state: SettingsState) => state.email.maxAttachmentSize;

export const selectSidebarCollapsedSetting = (state: SettingsState) => state.ui.sidebarCollapsed;
export const selectShowUnreadCount = (state: SettingsState) => state.ui.showUnreadCount;
export const selectCompactMode = (state: SettingsState) => state.ui.compactMode;
export const selectFontSize = (state: SettingsState) => state.ui.fontSize;
export const selectShowTimestamps = (state: SettingsState) => state.ui.showTimestamps;

export const selectAutoLogout = (state: SettingsState) => state.security.autoLogout;
export const selectSessionTimeout = (state: SettingsState) => state.security.sessionTimeout;
export const selectRequirePasswordForSettings = (state: SettingsState) => state.security.requirePasswordForSettings;

// Computed Selectors (combine multiple selectors)
export const selectAppState = (authState: AuthState, emailState: EmailState, uiState: UIState) => ({
  isAuthenticated: selectIsAuthenticated(authState),
  emailCount: selectEmailCount(emailState),
  unreadCount: selectUnreadCount(emailState),
  theme: selectTheme(uiState),
  loading: selectEmailLoading(emailState) || selectUILoading(uiState),
});

// Performance optimized selectors with memoization
export const createMemoizedSelector = <T, R>(
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean
) => {
  let lastState: T | null = null;
  let lastResult: R | null = null;
  
  return (state: T): R => {
    if (lastState === state) {
      return lastResult!;
    }
    
    const result = selector(state);
    
    if (equalityFn && lastResult !== null) {
      if (equalityFn(lastResult, result)) {
        return lastResult;
      }
    }
    
    lastState = state;
    lastResult = result;
    return result;
  };
}; 