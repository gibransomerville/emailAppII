// Search Management Module
// Coordinates search functionality across local and IMAP search engines

// Import search engines
import { EmailSearchEngine, IMAPSearchEngine } from '../managers/search-engine.js';
import { Email } from '../../types/email';
import { 
    SearchOptions, 
    SearchResult, 
    SearchHistoryItem, 
    SearchSuggestion,
    SearchStats,
    // IMAPConfig
} from '../../types/config';

interface IMAPSearchResult {
    uids: number[];
    count: number;
}

interface CombinedSearchResult {
    results: string[];
    query: string;
    totalResults: number;
    searchTime: number;
    searchType: 'combined';
    sources: {
        local: SearchResult;
        imap: IMAPSearchResult | null;
    };
    imapCount?: number;
}

interface SearchDisplayData {
    local: SearchResult;
    imap: IMAPSearchResult | null;
    combined: CombinedSearchResult;
    query: string;
}

interface SearchUI {
    displaySearchResults(data: SearchDisplayData): void;
    clearSearch(): void;
    showSearchError(message: string): void;
}

interface SearchTestResult {
    success: boolean;
    error?: string;
    stats?: SearchStats;
    simpleResults?: Record<string, {
        results: number;
        time: string;
        type: string;
    }>;
    advancedResults?: Record<string, {
        results: number;
        time: string;
        type: string;
        parsed: any;
    }>;
}

interface SearchConfig {
    isInitialized: boolean;
    hasLocalEngine: boolean;
    hasIMAPEngine: boolean;
    canUseIMAP: boolean;
    historySize: number;
    maxHistorySize: number;
}

/**
 * Search Manager - Coordinates search functionality
 */
class SearchManager {
    private searchEngine: EmailSearchEngine | null;
    private imapSearchEngine: IMAPSearchEngine | null;
    private searchUI: SearchUI | null;
    private isInitialized: boolean;
    private searchHistory: SearchHistoryItem[];
    private readonly maxHistorySize: number;

    constructor() {
        this.searchEngine = null;
        this.imapSearchEngine = null;
        this.searchUI = null;
        this.isInitialized = false;
        this.searchHistory = [];
        this.maxHistorySize = 50;
    }

    /**
     * Initialize search manager
     */
    async initialize(): Promise<void> {
        try {
            this.initializeSearchEngines();
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
        // Initialize local search engine
        if (!this.searchEngine) {
            this.searchEngine = new EmailSearchEngine();
        }

        // IMAP search engine will be initialized when needed
        this.imapSearchEngine = null;
    }

    /**
     * Set search UI component
     */
    setSearchUI(searchUI: SearchUI): void {
        this.searchUI = searchUI;
    }

    /**
     * Perform search with both local and IMAP engines
     */
    async performSearch(query: string, options: SearchOptions = {}): Promise<CombinedSearchResult | undefined> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!query?.trim()) {
            this.clearSearch();
            return undefined;
        }

        try {
            this.ensureSearchEngineReady();
            
            // Perform local search
            const localResults = this.searchEngine!.search(query);
            console.log('Local search results:', localResults);

            // Try IMAP search if available and enabled
            let imapResults: IMAPSearchResult | null = null;
            if (options.useIMAP && this.canUseIMAPSearch()) {
                imapResults = await this.performIMAPSearch(query);
            }

            // Combine results
            const combinedResults = this.combineSearchResults(localResults, imapResults);

            // Display results
            if (this.searchUI) {
                this.searchUI.displaySearchResults({
                    local: localResults,
                    imap: imapResults,
                    combined: combinedResults,
                    query: query
                });
            }

            this.logSearchStats(localResults, imapResults);
            this.addToHistory(query, combinedResults.totalResults);

            return combinedResults;

        } catch (error) {
            console.error('Search error:', error);
            if (this.searchUI) {
                this.searchUI.showSearchError((error as Error).message);
            }
            throw error;
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
        if ((window as any).emails?.length && (window as any).emails.length > 0) {
            const stats = this.searchEngine.getSearchStats();
            if (stats.totalEmails === 0) {
                console.log('Building search index for', (window as any).emails.length, 'emails');
                this.searchEngine.buildIndex((window as any).emails);
            }
        }
    }

    /**
     * Check if IMAP search can be used
     */
    private canUseIMAPSearch(): boolean {
        return !!((window as any).emailConfig && !(window as any).googleAuth && IMAPSearchEngine);
    }

    /**
     * Perform IMAP search
     */
    private async performIMAPSearch(query: string): Promise<IMAPSearchResult | null> {
        try {
            if (!this.imapSearchEngine && (window as any).emailConfig) {
                this.imapSearchEngine = new IMAPSearchEngine((window as any).emailConfig);
            }
            
            if (this.imapSearchEngine) {
                const imapUIDs = await this.imapSearchEngine.searchIMAP(query);
                return {
                    uids: imapUIDs,
                    count: imapUIDs.length
                };
            }
            return null;
        } catch (imapError) {
            console.warn('IMAP search failed, using local results only:', imapError);
            return null;
        }
    }

    /**
     * Combine search results from different engines
     */
    private combineSearchResults(localResults: SearchResult, imapResults: IMAPSearchResult | null): CombinedSearchResult {
        const combined: CombinedSearchResult = {
            results: localResults.results || [],
            query: localResults.query,
            totalResults: localResults.totalResults || 0,
            searchTime: localResults.searchTime || 0,
            searchType: 'combined',
            sources: {
                local: localResults,
                imap: imapResults
            }
        };

        // If we have IMAP results, merge them
        if (imapResults && imapResults.uids) {
            // For now, just add IMAP count to total
            // In a full implementation, you'd fetch the actual emails and merge them
            combined.totalResults += imapResults.count;
            combined.imapCount = imapResults.count;
        }

        return combined;
    }

    /**
     * Clear search results
     */
    clearSearch(): void {
        if (this.searchUI) {
            this.searchUI.clearSearch();
        }
    }

    /**
     * Log search statistics
     */
    private logSearchStats(localResults: SearchResult, imapResults: IMAPSearchResult | null): void {
        let stats: SearchStats | null = null;
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
        this.searchEngine!.buildIndex(emails);
        console.log('Search index built for', emails.length, 'emails');
    }

    /**
     * Get search engine statistics
     */
    getSearchStats(): SearchStats | null {
        return this.searchEngine?.getSearchStats() || null;
    }

    /**
     * Add search to history
     */
    private addToHistory(query: string, resultCount: number): void {
        this.searchHistory.unshift({
            query: query,
            resultCount: resultCount,
            timestamp: new Date()
        });

        // Keep history size manageable
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
        }
    }

    /**
     * Get search history
     */
    getSearchHistory(): SearchHistoryItem[] {
        return this.searchHistory;
    }

    /**
     * Get search suggestions
     */
    getSuggestions(partial: string): SearchSuggestion[] {
        if (!this.searchEngine) {
            return [];
        }

        const suggestions: SearchSuggestion[] = [];
        const partialLower = partial.toLowerCase();
        
        // Add history suggestions
        this.searchHistory.forEach(item => {
            if (item.query.toLowerCase().includes(partialLower)) {
                suggestions.push({
                    type: 'history',
                    text: item.query,
                    resultCount: item.resultCount
                });
            }
        });
        
        // Add engine suggestions
        const engineSuggestions = this.searchEngine.getSuggestions(partial);
        suggestions.push(...engineSuggestions);
        
        return suggestions.slice(0, 10);
    }

    /**
     * Test search functionality
     */
    testSearchFunctionality(): SearchTestResult {
        if (!this.searchEngine) {
            console.error('Search engine not available for testing');
            return {
                success: false,
                error: 'Search engine not initialized'
            };
        }

        console.log('=== EMAIL SEARCH TEST ===');
        
        const stats = this.searchEngine.getSearchStats();
        console.log('Search Index Statistics:', stats);

        // Test simple searches
        const simpleQueries = ['project', 'meeting', 'email', 'test'];
        console.log('\n--- Simple Search Tests ---');
        
        const simpleResults: Record<string, { results: number; time: string; type: string }> = {};
        simpleQueries.forEach(query => {
            const results = this.searchEngine!.search(query);
            simpleResults[query] = {
                results: results.totalResults,
                time: results.searchTime + 'ms',
                type: results.searchType
            };
            console.log(`Search "${query}":`, simpleResults[query]);
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
        const advancedResults: Record<string, { results: number; time: string; type: string; parsed: any }> = {};
        advancedQueries.forEach(query => {
            const results = this.searchEngine!.search(query);
            advancedResults[query] = {
                results: results.totalResults,
                time: results.searchTime + 'ms',
                type: results.searchType,
                parsed: results.parsedQuery
            };
            console.log(`Advanced search "${query}":`, advancedResults[query]);
        });

        console.log('\n=== SEARCH TEST COMPLETE ===');

        return {
            success: true,
            stats: stats,
            simpleResults: simpleResults,
            advancedResults: advancedResults
        };
    }

    /**
     * Get search configuration
     */
    getSearchConfig(): SearchConfig {
        return {
            isInitialized: this.isInitialized,
            hasLocalEngine: !!this.searchEngine,
            hasIMAPEngine: !!this.imapSearchEngine,
            canUseIMAP: this.canUseIMAPSearch(),
            historySize: this.searchHistory.length,
            maxHistorySize: this.maxHistorySize
        };
    }
}

// Global search manager instance
let globalSearchManager: SearchManager | null = null;

/**
 * Initialize global search manager
 */
function initializeSearchManager(): SearchManager {
    if (!globalSearchManager) {
        console.log('Initializing global search manager...');
        globalSearchManager = new SearchManager();
        globalSearchManager.initialize();
        
        // Build index if emails are available
        if (typeof window !== 'undefined' && (window as any).emails && (window as any).emails.length > 0) {
            globalSearchManager.buildSearchIndex((window as any).emails);
        }
        
        // Make search manager globally available
        if (typeof window !== 'undefined') {
            (window as any).searchManager = globalSearchManager;
            (window as any).performSearch = (query: string, options?: SearchOptions) => 
                globalSearchManager!.performSearch(query, options || {});
            (window as any).testSearchFunctionality = () => globalSearchManager!.testSearchFunctionality();
        }
    }
    return globalSearchManager;
}

/**
 * Get global search manager instance
 */
function getSearchManager(): SearchManager {
    if (!globalSearchManager) {
        return initializeSearchManager();
    }
    return globalSearchManager;
}

// Export functions and classes
const searchManagerExports = {
    SearchManager,
    initializeSearchManager,
    getSearchManager,
    
    // Convenience functions
    performSearch: (query: string, options?: SearchOptions): Promise<CombinedSearchResult | undefined> => {
        const manager = getSearchManager();
        return manager.performSearch(query, options || {});
    },
    
    testSearchFunctionality: (): SearchTestResult => {
        const manager = getSearchManager();
        return manager.testSearchFunctionality();
    },
    
    buildSearchIndex: (emails: Email[]): void => {
        const manager = getSearchManager();
        return manager.buildSearchIndex(emails);
    },
    
    getSearchStats: (): SearchStats | null => {
        const manager = getSearchManager();
        return manager.getSearchStats();
    }
};

// Global assignment for browser environments
if (typeof window !== 'undefined') {
    (window as any).SearchManager = SearchManager;
    (window as any).initializeSearchManager = initializeSearchManager;
    (window as any).getSearchManager = getSearchManager;
}

// ES Module exports for modern bundlers like Vite
export default searchManagerExports;
export { 
    SearchManager, 
    initializeSearchManager, 
    getSearchManager,
    type SearchConfig,
    type SearchTestResult,
    type CombinedSearchResult,
    type IMAPSearchResult,
    type SearchDisplayData,
    type SearchUI
}; 