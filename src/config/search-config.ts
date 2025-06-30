/**
 * Search Configuration Module
 * Contains all search-related configuration and constants
 */

import type { 
  SearchConfigComplete,
  SearchValidationResult,
  SearchStats,
  // SearchResult,
  IndexStats
} from '../../types/config';

export const SEARCH_CONFIG: SearchConfigComplete = {
    // Search engine settings
    ENGINE: {
        DEBOUNCE_DELAY: 300, // milliseconds
        MAX_HISTORY_SIZE: 50,
        MAX_SUGGESTIONS: 10,
        INDEX_BATCH_SIZE: 100
    },

    // Search operators and syntax
    OPERATORS: {
        FROM: 'from:',
        TO: 'to:',
        SUBJECT: 'subject:',
        HAS_ATTACHMENT: 'has:attachment',
        AFTER: 'after:',
        BEFORE: 'before:'
    },

    // Relevance scoring weights
    SCORING: {
        SUBJECT_MATCH: 10,
        PARTICIPANT_MATCH: 5,
        BODY_MATCH: 1,
        ATTACHMENT_MATCH: 3
    },

    // Stop words for search indexing
    STOP_WORDS: [
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
        'to', 'was', 'will', 'with', 'you', 'your', 'this', 'that', 'these',
        'those', 'i', 'me', 'my', 'we', 'our', 'us', 'have', 'had', 'will',
        'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall'
    ],

    // IMAP search criteria mapping
    IMAP_CRITERIA: {
        SUPPORTED: [
            'ALL', 'ANSWERED', 'BCC', 'BEFORE', 'BODY', 'CC', 'DELETED', 'DRAFT',
            'FLAGGED', 'FROM', 'HEADER', 'KEYWORD', 'LARGER', 'NEW', 'NOT',
            'OLD', 'ON', 'OR', 'RECENT', 'SEEN', 'SENTBEFORE', 'SENTON',
            'SENTONCE', 'SENTSINCE', 'SINCE', 'SMALLER', 'SUBJECT', 'TEXT',
            'TO', 'UID', 'UNANSWERED', 'UNDELETED', 'UNDRAFT', 'UNFLAGGED',
            'UNKEYWORD', 'UNSEEN'
        ],
        
        OPERATOR_MAPPING: {
            'from:': 'FROM',
            'to:': 'TO',
            'subject:': 'SUBJECT',
            'before:': 'BEFORE',
            'after:': 'SINCE'
        }
    },

    // UI configuration
    UI: {
        SEARCH_RESULT_CLASSES: {
            CONTAINER: 'conversation-item search-result',
            HIGHLIGHT: 'search-highlight',
            MATCH_COUNT: 'search-match-count',
            RESULT_BADGE: 'search-result-badge',
            NO_RESULTS: 'no-search-results',
            SEARCH_TIPS: 'search-tips'
        },

        SEARCH_TIPS: [
            'Try different keywords',
            'Use <code>from:email@domain.com</code> to search by sender',
            'Use <code>subject:"your subject"</code> to search by subject',
            'Use <code>after:2024-01-01</code> to search by date',
            'Use <code>has:attachment</code> to find emails with attachments'
        ]
    },

    // Performance settings
    PERFORMANCE: {
        MIN_WORD_LENGTH: 2,
        MAX_WORD_LENGTH: 50,
        INDEX_UPDATE_THRESHOLD: 100, // emails
        SEARCH_TIMEOUT: 5000, // milliseconds
        IMAP_SEARCH_TIMEOUT: 10000 // milliseconds
    },

    // Feature flags
    FEATURES: {
        ENABLE_IMAP_SEARCH: true,
        ENABLE_SEARCH_SUGGESTIONS: true,
        ENABLE_SEARCH_HISTORY: true,
        ENABLE_FUZZY_SEARCH: false,
        ENABLE_SEARCH_ANALYTICS: true
    }
};

/**
 * Search Utilities Class
 */
export class SearchUtils {
    /**
     * Validate search query
     */
    static validateQuery(query: string): SearchValidationResult {
        if (!query || typeof query !== 'string') {
            return { valid: false, error: 'Query must be a non-empty string' };
        }

        if (query.trim().length === 0) {
            return { valid: false, error: 'Query cannot be empty' };
        }

        if (query.length > 500) {
            return { valid: false, error: 'Query too long (max 500 characters)' };
        }

        return { valid: true };
    }

    /**
     * Parse date from string
     */
    static parseDate(dateString: string): Date {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date');
            }
            return date;
        } catch (error) {
            throw new Error(`Invalid date format: ${dateString}`);
        }
    }

    /**
     * Normalize search term
     */
    static normalizeTerm(term: string): string {
        return term
            .toLowerCase()
            .trim()
            .replace(/[^\w\s@.-]/g, ' ')
            .replace(/\s+/g, ' ');
    }

    /**
     * Extract email addresses from text
     */
    static extractEmails(text: string): string[] {
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        return text.match(emailRegex) || [];
    }

    /**
     * Check if term is a stop word
     */
    static isStopWord(term: string): boolean {
        return SEARCH_CONFIG.STOP_WORDS.includes(term.toLowerCase());
    }

    /**
     * Generate search statistics from index stats
     */
    static generateSearchStats(indexStats: IndexStats): SearchStats {
        return {
            totalEmails: indexStats.totalEmails,
            uniqueWords: 0, // Will be filled by search engine
            participants: 0, // Will be filled by search engine
            subjects: 0, // Will be filled by search engine
            datesIndexed: 0, // Will be filled by search engine
            attachments: 0, // Will be filled by search engine
            lastIndexUpdate: indexStats.lastUpdated,
            searchHistorySize: 0 // Will be filled by search engine
        };
    }

    /**
     * Format search time for display
     */
    static formatSearchTime(milliseconds: number): string {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`;
        } else {
            return `${(milliseconds / 1000).toFixed(1)}s`;
        }
    }

    /**
     * Create search result summary
     */
    static createResultSummary(results: any[], query: string): string {
        const count = results.length;
        
        if (count === 0) {
            return `No results found for "${query}"`;
        } else if (count === 1) {
            return `1 result found for "${query}"`;
        } else {
            return `${count} results found for "${query}"`;
        }
    }

    /**
     * Highlight terms in text
     */
    static highlightTerms(text: string, terms: string[], highlightClass: string = 'search-highlight'): string {
        if (!text || !terms?.length) return text;

        let highlightedText = text;
        terms.forEach(term => {
            const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
            highlightedText = highlightedText.replace(
                regex, 
                `<mark class="${highlightClass}">$1</mark>`
            );
        });

        return highlightedText;
    }

    /**
     * Escape regex special characters
     */
    static escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Debounce function
     */
    static debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
        let timeout: number;
        return function executedFunction(...args: Parameters<T>) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait) as any;
        };
    }

    /**
     * Throttle function
     */
    static throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
        let inThrottle: boolean;
        return function(this: any, ...args: Parameters<T>) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

/**
 * Search Error Classes
 */
export class SearchError extends Error {
    public code: string;

    constructor(message: string, code: string = 'SEARCH_ERROR') {
        super(message);
        this.name = 'SearchError';
        this.code = code;
    }
}

export class SearchEngineNotInitializedError extends SearchError {
    constructor() {
        super('Search engine not initialized', 'ENGINE_NOT_INITIALIZED');
    }
}

export class InvalidSearchQueryError extends SearchError {
    public query: string;

    constructor(query: string) {
        super(`Invalid search query: ${query}`, 'INVALID_QUERY');
        this.query = query;
    }
}

export class IMAPSearchError extends SearchError {
    constructor(message: string) {
        super(`IMAP search failed: ${message}`, 'IMAP_ERROR');
    }
}

/**
 * Search Event System
 */
export class SearchEventEmitter {
    private events: Record<string, Function[]> = {};

    on(event: string, callback: Function): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event: string, callback: Function): void {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event: string, data?: any): void {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in search event handler for ${event}:`, error);
            }
        });
    }
}

// Export for module systems (Node.js compatibility)
export default {
    SEARCH_CONFIG,
    SearchUtils,
    SearchError,
    SearchEngineNotInitializedError,
    InvalidSearchQueryError,
    IMAPSearchError,
    SearchEventEmitter
};

// Global assignment for browser environments
if (typeof window !== 'undefined') {
    (window as any).SEARCH_CONFIG = SEARCH_CONFIG;
    (window as any).SearchUtils = SearchUtils;
    (window as any).SearchError = SearchError;
    (window as any).SearchEngineNotInitializedError = SearchEngineNotInitializedError;
    (window as any).InvalidSearchQueryError = InvalidSearchQueryError;
    (window as any).IMAPSearchError = IMAPSearchError;
    (window as any).SearchEventEmitter = SearchEventEmitter;
} 