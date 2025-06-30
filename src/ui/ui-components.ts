/**
 * UI Components Module
 * Handles search-related UI components and interactions
 */

// import type { 
//   SearchUIState, 
//   SearchResult, 
//   ConversationElement,
//   SearchHighlight,
//   HighlightMatch
// } from './types/ui';
import type { EmailConversation, Email } from '../../types/email';
import type { SearchUIState } from '../../types/ui';
// import type { Email as EmailType, EmailConversation, EmailAddress } from '../../types/email';

/**
 * Search UI state interface
 */
// interface SearchUIInternalState {
//   searchInput: HTMLInputElement | null;
//   conversationsList: HTMLElement | null;
//   isSearchMode: boolean;
//   currentQuery: string;
//   searchTimeout: NodeJS.Timeout | null;
//   debounceDelay: number;
// }

/**
 * Search data interface
 */
interface SearchData {
  local: {
    totalResults: number;
    results: string[];
    searchTime: number;
  };
  imap: {
    uids: number[];
    count: number;
  } | null;
  query: string;
}

/**
 * Conversation HTML data interface
 */
interface ConversationHTMLData {
  highlightedSender: string;
  highlightedSubject: string;
  highlightedPreview: string;
  conversation: EmailConversation;
  formattedTime: string;
  unreadCount: number;
}

/**
 * Search UI - Handles search interface and interactions
 */
class SearchUI {
  private searchInput: HTMLInputElement | null = null;
  private conversationsList: HTMLElement | null = null;
  private isSearchMode: boolean = false;
  private currentQuery: string = '';
  private searchTimeout: NodeJS.Timeout | null = null;
  private readonly debounceDelay: number = 300;

  /**
   * Initialize search UI components
   */
  initialize(): void {
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    this.conversationsList = document.getElementById('conversations-list');
    this.setupEventListeners();
  }

  /**
   * Setup search event listeners
   */
  private setupEventListeners(): void {
    if (!this.searchInput) return;

    // Real-time search with debouncing
    this.searchInput.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      clearTimeout(this.searchTimeout!);
      this.searchTimeout = setTimeout(() => {
        this.handleSearch(target.value);
      }, this.debounceDelay);
    });

    // Handle search on Enter key
    this.searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        clearTimeout(this.searchTimeout!);
        this.handleSearch((e.target as HTMLInputElement).value);
      }

      // Clear search on Escape key
      if (e.key === 'Escape') {
        this.clearSearch();
      }
    });
  }

  /**
   * Handle search input
   */
  async handleSearch(query: string): Promise<void> {
    this.currentQuery = query;
    
    if (!query.trim()) {
      this.clearSearch();
      return;
    }

    try {
      await (window as any).performSearch(query);
    } catch (error) {
      console.error('Search UI error:', error);
      this.showSearchError((error as Error).message);
    }
  }

  /**
   * Display search results
   */
  displaySearchResults(searchData: SearchData): void {
    const { local, query } = searchData;
    
    if (local.totalResults === 0) {
      this.showNoSearchResults(query);
      return;
    }

    const matchingConversations = this.filterConversationsBySearch(local.results);
    this.renderSearchConversations(matchingConversations, query);
    this.updateUIForSearchMode(true, local.totalResults, local.searchTime);
  }

  /**
   * Filter conversations by search results
   */
  private filterConversationsBySearch(emailIds: string[]): Record<string, EmailConversation & { totalEmails: number; matchingEmails: number }> {
    const matchingConversations: Record<string, EmailConversation & { totalEmails: number; matchingEmails: number }> = {};
    
    const conversations = (window as any).conversations || {};
    Object.entries(conversations).forEach(([conversationId, conversation]) => {
      const conv = conversation as EmailConversation;
      const matchingEmails = conv.emails.filter((email: Email) => 
        emailIds.includes(email.messageId || '')
      );
      
      if (matchingEmails.length > 0) {
        matchingConversations[conversationId] = {
          ...conv,
          emails: matchingEmails,
          totalEmails: conv.emails.length,
          matchingEmails: matchingEmails.length
        };
      }
    });
    
    return matchingConversations;
  }

  /**
   * Render search conversations with highlighting
   */
  private renderSearchConversations(matchingConversations: Record<string, EmailConversation & { totalEmails: number; matchingEmails: number }>, query: string): void {
    if (!this.conversationsList) return;
    
    this.conversationsList.innerHTML = '';
    
    if (Object.keys(matchingConversations).length === 0) {
      this.showNoSearchResults(query);
      return;
    }

    // Sort conversations by relevance
    const sortedConversations = Object.entries(matchingConversations)
      .sort(([, a], [, b]) => b.matchingEmails - a.matchingEmails);

    sortedConversations.forEach(([, conversation]) => {
      const conversationElement = this.createSearchConversationElement(conversation, query);
      this.conversationsList!.appendChild(conversationElement);
    });
  }

  /**
   * Create conversation element with search highlighting
   */
  private createSearchConversationElement(conversation: EmailConversation & { totalEmails: number; matchingEmails: number }, query: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'conversation-item search-result';
    div.dataset.conversationId = (conversation as any).safeId || conversation.id;
    div.dataset.originalConversationId = conversation.id;

    const latestEmail = conversation.emails[conversation.emails.length - 1];
    const date = new Date(latestEmail.date);
    const formattedTime = this.formatMessageTime(date);

    // Extract display name from sender
    const senderName = this.extractSenderName(conversation.participants[0] || 'Unknown');
    const unreadCount = conversation.emails.filter(e => !e.read).length;

    // Highlight search terms in content
    const highlightedSender = this.highlightSearchTerms(senderName, query);
    const highlightedSubject = this.highlightSearchTerms(latestEmail.subject || 'No Subject', query);
    const highlightedPreview = this.createHighlightedPreview(latestEmail, query);

    const conversationHTML = this.buildConversationHTML({
      highlightedSender,
      highlightedSubject,
      highlightedPreview,
      conversation,
      formattedTime,
      unreadCount
    });

    if ((window as any).SafeHTML) {
      (window as any).SafeHTML.setInnerHTML(div, conversationHTML, 'ui');
    } else {
      div.innerHTML = conversationHTML;
    }

    div.addEventListener('click', () => {
      // Use data attributes for modular event delegation
      const event = new CustomEvent('selectConversation', { 
        detail: { conversationId: conversation.id } 
      });
      document.dispatchEvent(event);
    });

    return div;
  }

  /**
   * Extract sender name from participant string
   */
  private extractSenderName(participant: string): string {
    const nameMatch = participant.match(/^(.+?)\s*<.+>$/);
    if (nameMatch) {
      return nameMatch[1].trim();
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailPattern.test(participant)) {
      return participant.split('@')[0];
    }
    
    return participant;
  }

  /**
   * Create highlighted preview from email content
   */
  private createHighlightedPreview(email: Email, query: string): string {
    const content = email.snippet || email.bodyText || email.body || '';
    const maxLength = 150;
    
    if (content.length <= maxLength) {
      return this.highlightSearchTerms(content, query);
    }

    // Find the best match position
    const queryTerms = query.toLowerCase().split(/\s+/);
    let bestPosition = 0;
    let bestScore = 0;

    for (const term of queryTerms) {
      const position = content.toLowerCase().indexOf(term);
      if (position !== -1) {
        const score = Math.abs(position - (content.length / 2));
        if (score > bestScore) {
          bestScore = score;
          bestPosition = position;
        }
      }
    }

    // Extract content around the best match
    const start = Math.max(0, bestPosition - maxLength / 2);
    const end = Math.min(content.length, start + maxLength);
    const preview = content.substring(start, end);

    // Add ellipsis if needed
    const prefix = start > 0 ? '...' : '';
    const suffix = end < content.length ? '...' : '';

    return prefix + this.highlightSearchTerms(preview, query) + suffix;
  }

  /**
   * Build conversation HTML
   */
  private buildConversationHTML(data: ConversationHTMLData): string {
    const { highlightedSender, highlightedSubject, highlightedPreview, conversation, formattedTime, unreadCount } = data;
    
    const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
    const attachmentIcon = conversation.hasAttachments ? '<span class="attachment-icon">📎</span>' : '';
    
    return `
      <div class="conversation-header">
        <div class="sender-info">
          <span class="sender-name">${highlightedSender}</span>
          ${unreadBadge}
        </div>
        <div class="conversation-meta">
          <span class="time">${formattedTime}</span>
          ${attachmentIcon}
        </div>
      </div>
      <div class="conversation-subject">${highlightedSubject}</div>
      <div class="conversation-preview">${highlightedPreview}</div>
    `;
  }

  /**
   * Highlight search terms in text
   */
  private highlightSearchTerms(text: string, query: string): string {
    if (!query.trim()) return this.escapeHtml(text);

    const escapedQuery = this.escapeRegex(query);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    return this.escapeHtml(text).replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /**
   * Show no search results message
   */
  private showNoSearchResults(query: string): void {
    if (!this.conversationsList) return;

    this.conversationsList.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-title">No results found</div>
        <div class="no-results-message">
          No emails found matching "<strong>${this.escapeHtml(query)}</strong>"
        </div>
        <div class="no-results-suggestions">
          <p>Try:</p>
          <ul>
            <li>Using different keywords</li>
            <li>Checking your spelling</li>
            <li>Using advanced search operators (from:, to:, subject:)</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Update UI for search mode
   */
  private updateUIForSearchMode(isSearchMode: boolean, resultCount: number = 0, searchTime: number = 0): void {
    this.isSearchMode = isSearchMode;
    
    if (isSearchMode) {
      this.addSearchResultsHeader(resultCount, searchTime);
    } else {
      this.removeSearchResultsHeader();
    }
  }

  /**
   * Add search results header
   */
  private addSearchResultsHeader(resultCount: number, searchTime: number): void {
    if (!this.conversationsList) return;

    const existingHeader = this.conversationsList.querySelector('.search-results-header');
    if (existingHeader) {
      existingHeader.remove();
    }

    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.innerHTML = `
      <div class="search-results-info">
        <span class="results-count">${resultCount} result${resultCount !== 1 ? 's' : ''}</span>
        <span class="search-time">(${searchTime}ms)</span>
      </div>
      <button class="clear-search-btn" onclick="window.getSearchManager()?.searchUI?.clearSearch()">
        Clear Search
      </button>
    `;

    this.conversationsList.insertBefore(header, this.conversationsList.firstChild);
  }

  /**
   * Remove search results header
   */
  private removeSearchResultsHeader(): void {
    if (!this.conversationsList) return;

    const header = this.conversationsList.querySelector('.search-results-header');
    if (header) {
      header.remove();
    }
  }

  /**
   * Clear search and restore normal view
   */
  clearSearch(): void {
    this.currentQuery = '';
    this.isSearchMode = false;
    
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    
    this.removeSearchResultsHeader();
    
    // Restore normal conversation view
    if ((window as any).loadConversations) {
      (window as any).loadConversations();
    }
  }

  /**
   * Show search error message
   */
  showSearchError(message: string): void {
    if (!this.conversationsList) return;

    this.conversationsList.innerHTML = `
      <div class="search-error">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Search Error</div>
        <div class="error-message">${this.escapeHtml(message)}</div>
      </div>
    `;
  }

  /**
   * Format message time
   */
  private formatMessageTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get current search state
   */
  getSearchState(): SearchUIState {
    return {
      query: this.currentQuery,
      isActive: this.isSearchMode,
      isLoading: false,
      results: [],
      resultCount: this.conversationsList?.children.length || 0,
      searchTime: 0,
      hasMore: false
    };
  }
}

/**
 * Search Manager - Coordinates search functionality
 */
class SearchManager {
  private searchEngine: any = null;
  private searchUI: SearchUI;
  private isInitialized: boolean = false;

  constructor() {
    this.searchUI = new SearchUI();
  }

  /**
   * Initialize search manager
   */
  async initialize(): Promise<void> {
    try {
      this.initializeSearchEngines();
      this.searchUI.initialize();
      this.isInitialized = true;
      console.log('Search manager initialized successfully');
    } catch (error) {
      console.error('Search manager initialization failed:', error);
    }
  }

  /**
   * Initialize search engines
   */
  private initializeSearchEngines(): void {
    if (!(window as any).emailSearchEngine && (window as any).EmailSearchEngine) {
      (window as any).emailSearchEngine = new (window as any).EmailSearchEngine();
      this.searchEngine = (window as any).emailSearchEngine;
    }

    if (!(window as any).IMAPSearchEngine) {
      (window as any).IMAPSearchEngine = (window as any).IMAPSearchEngine;
    }
  }

  /**
   * Perform search with both local and IMAP engines
   */
  async performSearch(query: string, options: { useIMAP?: boolean } = {}): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!query?.trim()) {
      this.searchUI.clearSearch();
      return;
    }

    try {
      this.ensureSearchEngineReady();
      
      // Perform local search
      const localResults = this.searchEngine.search(query, options);
      console.log('Local search results:', localResults);

      // Try IMAP search if available and enabled
      let imapResults = null;
      if (options.useIMAP && this.canUseIMAPSearch()) {
        imapResults = await this.performIMAPSearch(query, options);
      }

      // Display results
      this.searchUI.displaySearchResults({
        local: localResults,
        imap: imapResults,
        query: query
      });

      this.logSearchStats(localResults, imapResults);

    } catch (error) {
      console.error('Search error:', error);
      this.searchUI.showSearchError((error as Error).message);
    }
  }

  /**
   * Ensure search engine is ready
   */
  private ensureSearchEngineReady(): void {
    if (!this.searchEngine) {
      this.initializeSearchEngines();
    }

    if (!this.searchEngine) {
      throw new Error('Search engine not initialized. Please wait for the application to fully load.');
    }

    // Build index if emails are available but not indexed
    const emails = (window as any).emails;
    if (emails?.length > 0) {
      const stats = this.searchEngine.getSearchStats();
      if (stats.totalEmails === 0) {
        console.log('Building search index for', emails.length, 'emails');
        this.searchEngine.buildIndex(emails);
      }
    }
  }

  /**
   * Check if IMAP search can be used
   */
  private canUseIMAPSearch(): boolean {
    return (window as any).emailConfig && !(window as any).googleAuth && (window as any).IMAPSearchEngine;
  }

  /**
   * Perform IMAP search
   */
  private async performIMAPSearch(query: string, options: any): Promise<{ uids: number[]; count: number } | null> {
    try {
      if (!(window as any).imapSearchEngine) {
        (window as any).imapSearchEngine = new (window as any).IMAPSearchEngine((window as any).emailConfig);
      }
      
      const imapUIDs = await (window as any).imapSearchEngine.searchIMAP(query, options);
      return {
        uids: imapUIDs,
        count: imapUIDs.length
      };
    } catch (imapError) {
      console.warn('IMAP search failed, using local results only:', imapError);
      return null;
    }
  }

  /**
   * Log search statistics
   */
  private logSearchStats(localResults: any, imapResults: any): void {
    let stats = null;
    if (this.searchEngine?.getSearchStats) {
      stats = this.searchEngine.getSearchStats();
    }

    console.log('Search Statistics:', {
      local: localResults,
      imap: imapResults,
      indexStats: stats
    });
  }

  /**
   * Build search index for emails
   */
  buildSearchIndex(emails: Email[]): void {
    if (!emails?.length) return;

    this.ensureSearchEngineReady();
    this.searchEngine.buildIndex(emails);
    console.log('Search index built for', emails.length, 'emails');
  }

  /**
   * Get search engine statistics
   */
  getSearchStats(): any {
    return this.searchEngine?.getSearchStats() || null;
  }

  /**
   * Test search functionality
   */
  testSearchFunctionality(): void {
    if (!this.searchEngine) {
      console.error('Search engine not available for testing');
      return;
    }

    console.log('=== EMAIL SEARCH TEST ===');
    
    const stats = this.searchEngine.getSearchStats();
    console.log('Search Index Statistics:', stats);

    // Test simple searches
    const simpleQueries = ['project', 'meeting', 'email', 'test'];
    console.log('\n--- Simple Search Tests ---');
    
    simpleQueries.forEach(query => {
      const results = this.searchEngine.search(query);
      console.log(`Search "${query}":`, {
        results: results.totalResults,
        time: results.searchTime + 'ms',
        type: results.searchType
      });
    });

    // Test advanced searches
    const advancedQueries = [
      'from:example.com',
      'subject:"meeting notes"',
      'has:attachment',
      'after:2024-01-01',
      'from:test@example.com subject:project'
    ];
    
    console.log('\n--- Advanced Search Tests ---');
    advancedQueries.forEach(query => {
      const results = this.searchEngine.search(query);
      console.log(`Advanced search "${query}":`, {
        results: results.totalResults,
        time: results.searchTime + 'ms',
        type: results.searchType,
        parsed: results.parsedQuery
      });
    });

    console.log('\n=== SEARCH TEST COMPLETE ===');
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SearchUI, SearchManager };
}

// Global assignment for browser environments
if (typeof window !== 'undefined') {
  (window as any).SearchUI = SearchUI;
  (window as any).SearchManager = SearchManager;
}

// Export the SearchUI class
export { SearchUI }; 