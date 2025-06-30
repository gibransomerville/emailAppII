/**
 * Email Search Engine Module
 * Provides comprehensive email search functionality with local indexing and IMAP support
 */

import { Email, Attachment } from '../../types/email';
import { 
    SearchResult, 
    SearchHistoryItem, 
    SearchSuggestion,
    SearchStats,
    ParsedQuery,
    DateRange,
    SearchableContent,
    IMAPSearchCriteria,
    IMAPConfig
} from '../../types/config';

interface EmailField {
    text?: string;
    name?: string;
    address?: string;
    value?: string;
}

type EmailFieldType = string | EmailField | EmailField[] | undefined;

interface SearchMethod {
    condition: boolean;
    method: () => string[];
}

interface OperatorMapping {
    regex: RegExp;
    imap: string;
    transform?: (value: string) => Date | string;
}

class EmailSearchEngine {
    private searchIndex: Map<string, SearchableContent>;
    private wordIndex: Map<string, Set<string>>;
    private participantIndex: Map<string, Set<string>>;
    private subjectIndex: Map<string, Set<string>>;
    private dateIndex: Map<string, Set<string>>;
    private attachmentIndex: Map<string, Set<string>>;
    private lastIndexUpdate: Date | null;
    private searchHistory: SearchHistoryItem[];
    private readonly maxHistorySize: number;
    private readonly stopWords: Set<string>;

    constructor() {
        this.searchIndex = new Map();
        this.wordIndex = new Map();
        this.participantIndex = new Map();
        this.subjectIndex = new Map();
        this.dateIndex = new Map();
        this.attachmentIndex = new Map();
        this.lastIndexUpdate = null;
        this.searchHistory = [];
        this.maxHistorySize = 50;
        this.stopWords = new Set([
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
            'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
            'to', 'was', 'will', 'with', 'you', 'your', 'this', 'that', 'these',
            'those', 'i', 'me', 'my', 'we', 'our', 'us'
        ]);
    }

    /**
     * Build search index from emails
     */
    buildIndex(emails: Email[]): void {
        console.log('Building search index for', emails.length, 'emails...');
        this.clearIndex();
        emails.forEach(email => this.indexEmail(email));
        this.lastIndexUpdate = new Date();
        this.logIndexStats(emails.length);
    }

    /**
     * Index a single email
     */
    indexEmail(email: Email): void {
        if (!email?.messageId) return;

        const messageId = email.messageId;
        const searchableContent = this.createSearchableContent(email);
        this.searchIndex.set(messageId, searchableContent);
        
        this.indexWords(messageId, searchableContent.allText);
        this.indexParticipants(messageId, email);
        this.indexSubject(messageId, email.subject);
        this.indexDate(messageId, email.date);
        this.indexAttachments(messageId, email.attachments);
    }

    /**
     * Create searchable content from email
     */
    private createSearchableContent(email: Email): SearchableContent {
        const content: SearchableContent = {
            subject: email.subject || '',
            from: this.extractEmailText(email.from),
            to: this.extractEmailText(email.to),
            cc: this.extractEmailText(email.cc),
            body: email.bodyText || email.body || '',
            htmlBody: email.bodyHtml || '',
            attachmentNames: (email.attachments || []).map(a => a.filename || '').join(' '),
            allText: ''
        };
        
        content.allText = [
            content.subject, content.from, content.to, 
            content.cc, content.body, content.attachmentNames
        ].join(' ').toLowerCase();
        
        return content;
    }

    /**
     * Extract text from various email field formats
     */
    private extractEmailText(field: EmailFieldType): string {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (Array.isArray(field)) return field.map(item => this.extractEmailText(item)).join(' ');
        
        if (typeof field === 'object') {
            return field.text || 
                   (field.name && field.address ? `${field.name} ${field.address}` : '') ||
                   field.address || field.value || '';
        }
        
        return String(field);
    }

    /**
     * Tokenize text into searchable words
     */
    private tokenizeText(text: string): string[] {
        if (!text) return [];
        
        return text
            .toLowerCase()
            .replace(/[^\w\s@.-]/g, ' ')
            .split(/\s+/)
            .filter(word => 
                word.length > 2 && 
                !this.stopWords.has(word) &&
                !/^\d+$/.test(word)
            );
    }

    /**
     * Perform comprehensive search
     */
    search(query: string): SearchResult {
        const startTime = Date.now();
        
        if (!query?.trim()) {
            return this.createEmptySearchResult(query);
        }
        
        const parsedQuery = this.parseQuery(query);
        const results = parsedQuery.isAdvanced 
            ? this.performAdvancedSearch(parsedQuery)
            : this.performSimpleSearch(parsedQuery.terms);
        
        const sortedResults = this.sortByRelevance(results, query);
        this.addToHistory(query, sortedResults.length);
        
        return {
            results: sortedResults,
            query: query,
            totalResults: sortedResults.length,
            searchTime: Date.now() - startTime,
            searchType: parsedQuery.isAdvanced ? 'advanced' : 'simple',
            parsedQuery: parsedQuery
        };
    }

    /**
     * Parse search query into structured format
     */
    private parseQuery(query: string): ParsedQuery {
        const parsed: ParsedQuery = {
            terms: [],
            from: [],
            to: [],
            subject: [],
            hasAttachment: false,
            dateRange: null,
            isAdvanced: false
        };
        
        const operators = [
            { regex: /from:([^\s]+)/gi, field: 'from' },
            { regex: /to:([^\s]+)/gi, field: 'to' },
            { regex: /subject:([^\s"]+|"[^"]*")/gi, field: 'subject' },
            { regex: /has:attachment/gi, field: 'hasAttachment' },
            { regex: /after:(\d{4}-\d{2}-\d{2})/gi, field: 'after' },
            { regex: /before:(\d{4}-\d{2}-\d{2})/gi, field: 'before' }
        ];
        
        let remainingQuery = query;
        
        operators.forEach(op => {
            let match;
            while ((match = op.regex.exec(query)) !== null) {
                parsed.isAdvanced = true;
                this.processOperatorMatch(parsed, op.field, match[1]);
                remainingQuery = remainingQuery.replace(match[0], '').trim();
            }
        });
        
        if (remainingQuery.trim()) {
            parsed.terms = this.tokenizeText(remainingQuery);
        }
        
        return parsed;
    }

    /**
     * Process operator match for query parsing
     */
    private processOperatorMatch(parsed: ParsedQuery, field: string, value: string): void {
        if (field === 'hasAttachment') {
            parsed.hasAttachment = true;
        } else if (field === 'after' || field === 'before') {
            if (!parsed.dateRange) parsed.dateRange = {};
            (parsed.dateRange as any)[field] = value;
        } else {
            (parsed as any)[field].push(value.replace(/"/g, ''));
        }
    }

    /**
     * Perform advanced search with operators
     */
    private performAdvancedSearch(parsedQuery: ParsedQuery): string[] {
        let results = new Set<string>();
        let isFirstCondition = true;
        
        const searchMethods: SearchMethod[] = [
            { condition: parsedQuery.terms.length > 0, method: () => this.searchByTerms(parsedQuery.terms) },
            { condition: parsedQuery.from.length > 0, method: () => this.searchByParticipants(parsedQuery.from) },
            { condition: parsedQuery.to.length > 0, method: () => this.searchByParticipants(parsedQuery.to) },
            { condition: parsedQuery.subject.length > 0, method: () => this.searchBySubject(parsedQuery.subject) },
            { condition: parsedQuery.hasAttachment, method: () => this.searchByAttachments() },
            { condition: !!parsedQuery.dateRange, method: () => this.searchByDateRange(parsedQuery.dateRange!) }
        ];
        
        searchMethods.forEach(({ condition, method }) => {
            if (condition) {
                const searchResults = method();
                if (isFirstCondition) {
                    results = new Set(searchResults);
                    isFirstCondition = false;
                } else {
                    results = this.intersectSets(results, new Set(searchResults));
                }
            }
        });
        
        return Array.from(results);
    }

    /**
     * Perform simple text search
     */
    private performSimpleSearch(terms: string[]): string[] {
        return terms.length === 0 ? [] : this.searchByTerms(terms);
    }

    /**
     * Search by terms in all text content
     */
    private searchByTerms(terms: string[]): string[] {
        const results = new Set<string>();
        
        terms.forEach(term => {
            // Exact word match
            if (this.wordIndex.has(term)) {
                this.wordIndex.get(term)!.forEach(id => results.add(id));
            }
            
            // Partial word match
            for (const [word, ids] of this.wordIndex) {
                if (word.includes(term)) {
                    ids.forEach(id => results.add(id));
                }
            }
        });
        
        return Array.from(results);
    }

    /**
     * Search by participants (from/to/cc)
     */
    private searchByParticipants(participants: string[]): string[] {
        const results = new Set<string>();
        
        participants.forEach(participant => {
            const term = participant.toLowerCase();
            for (const [indexed, ids] of this.participantIndex) {
                if (indexed.includes(term)) {
                    ids.forEach(id => results.add(id));
                }
            }
        });
        
        return Array.from(results);
    }

    /**
     * Search by subject
     */
    private searchBySubject(subjects: string[]): string[] {
        const results = new Set<string>();
        
        subjects.forEach(subject => {
            const term = subject.toLowerCase();
            for (const [indexed, ids] of this.subjectIndex) {
                if (indexed.includes(term)) {
                    ids.forEach(id => results.add(id));
                }
            }
        });
        
        return Array.from(results);
    }

    /**
     * Search emails with attachments
     */
    private searchByAttachments(): string[] {
        const results = new Set<string>();
        for (const ids of this.attachmentIndex.values()) {
            ids.forEach(id => results.add(id));
        }
        return Array.from(results);
    }

    /**
     * Search by date range
     */
    private searchByDateRange(dateRange: DateRange): string[] {
        const results = new Set<string>();
        
        for (const [dateString, ids] of this.dateIndex) {
            const includeDate = this.isDateInRange(dateString, dateRange);
            if (includeDate) {
                ids.forEach(id => results.add(id));
            }
        }
        
        return Array.from(results);
    }

    /**
     * Check if date is in range
     */
    private isDateInRange(dateString: string, dateRange: DateRange): boolean {
        if (dateRange.after && dateString < dateRange.after) return false;
        if (dateRange.before && dateString > dateRange.before) return false;
        return true;
    }

    /**
     * Sort results by relevance
     */
    private sortByRelevance(results: string[], query: string): string[] {
        const terms = this.tokenizeText(query);
        
        return results.map(messageId => {
            const content = this.searchIndex.get(messageId);
            if (!content) return { messageId, score: 0 };
            
            const score = this.calculateRelevanceScore(content, terms);
            return { messageId, score };
        })
        .sort((a, b) => b.score - a.score)
        .map(item => item.messageId);
    }

    /**
     * Calculate relevance score for content
     */
    private calculateRelevanceScore(content: SearchableContent, terms: string[]): number {
        let score = 0;
        
        terms.forEach(term => {
            if (content.subject.toLowerCase().includes(term)) score += 10;
            if (content.from.toLowerCase().includes(term) || 
                content.to.toLowerCase().includes(term)) score += 5;
            if (content.body.toLowerCase().includes(term)) score += 1;
        });
        
        return score;
    }

    // Helper methods for indexing
    private indexWords(messageId: string, text: string): void {
        const words = this.tokenizeText(text);
        words.forEach(word => {
            if (!this.wordIndex.has(word)) {
                this.wordIndex.set(word, new Set());
            }
            this.wordIndex.get(word)!.add(messageId);
        });
    }

    private indexParticipants(messageId: string, email: Email): void {
        const participants = [
            ...this.extractParticipants(email.from),
            ...this.extractParticipants(email.to),
            ...this.extractParticipants(email.cc)
        ];
        
        participants.forEach(participant => {
            const normalizedParticipant = participant.toLowerCase();
            if (!this.participantIndex.has(normalizedParticipant)) {
                this.participantIndex.set(normalizedParticipant, new Set());
            }
            this.participantIndex.get(normalizedParticipant)!.add(messageId);
        });
    }

    private extractParticipants(field: EmailFieldType): string[] {
        if (!field) return [];
        
        const participants: string[] = [];
        const text = this.extractEmailText(field);
        
        // Extract email addresses
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        const emails = text.match(emailRegex) || [];
        participants.push(...emails);
        
        // Extract names
        const nameRegex = /([^<>,]+)(?:\s*<[^>]*>)?/g;
        let match;
        while ((match = nameRegex.exec(text)) !== null) {
            const name = match[1].trim();
            if (name && !emailRegex.test(name)) {
                participants.push(name);
            }
        }
        
        return participants.filter(p => p.length > 0);
    }

    private indexSubject(messageId: string, subject?: string): void {
        if (!subject) return;
        
        const normalizedSubject = this.normalizeSubject(subject);
        if (!this.subjectIndex.has(normalizedSubject)) {
            this.subjectIndex.set(normalizedSubject, new Set());
        }
        this.subjectIndex.get(normalizedSubject)!.add(messageId);
    }

    private normalizeSubject(subject: string): string {
        if (!subject) return '';
        return subject
            .toLowerCase()
            .replace(/^(re|fwd|fw):\s*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private indexDate(messageId: string, date?: string | Date): void {
        if (!date) return;
        
        try {
            const dateObj = new Date(date);
            const dateString = dateObj.toISOString().split('T')[0];
            
            if (!this.dateIndex.has(dateString)) {
                this.dateIndex.set(dateString, new Set());
            }
            this.dateIndex.get(dateString)!.add(messageId);
        } catch (error) {
            console.warn('Error indexing date:', date, error);
        }
    }

    private indexAttachments(messageId: string, attachments?: Attachment[]): void {
        if (!attachments || !Array.isArray(attachments)) return;
        
        attachments.forEach(attachment => {
            if (attachment.filename) {
                const filename = attachment.filename.toLowerCase();
                if (!this.attachmentIndex.has(filename)) {
                    this.attachmentIndex.set(filename, new Set());
                }
                this.attachmentIndex.get(filename)!.add(messageId);
            }
        });
    }

    // Utility methods
    private clearIndex(): void {
        this.searchIndex.clear();
        this.wordIndex.clear();
        this.participantIndex.clear();
        this.subjectIndex.clear();
        this.dateIndex.clear();
        this.attachmentIndex.clear();
    }

    private intersectSets(set1: Set<string>, set2: Set<string>): Set<string> {
        const result = new Set<string>();
        for (const item of set1) {
            if (set2.has(item)) {
                result.add(item);
            }
        }
        return result;
    }

    private addToHistory(query: string, resultCount: number): void {
        const historyItem: SearchHistoryItem = {
            query: query,
            timestamp: new Date(),
            resultCount: resultCount
        };
        
        this.searchHistory.unshift(historyItem);
        
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
        }
    }

    private createEmptySearchResult(query: string): SearchResult {
        return {
            results: [],
            query: query,
            totalResults: 0,
            searchTime: 0,
            searchType: 'empty'
        };
    }

    private logIndexStats(emailCount: number): void {
        console.log('Search index built:', {
            totalEmails: emailCount,
            uniqueWords: this.wordIndex.size,
            participants: this.participantIndex.size,
            subjects: this.subjectIndex.size,
            indexedDates: this.dateIndex.size
        });
    }

    getSearchStats(): SearchStats {
        return {
            totalEmails: this.searchIndex.size,
            uniqueWords: this.wordIndex.size,
            participants: this.participantIndex.size,
            subjects: this.subjectIndex.size,
            datesIndexed: this.dateIndex.size,
            attachments: this.attachmentIndex.size,
            lastIndexUpdate: this.lastIndexUpdate,
            searchHistorySize: this.searchHistory.length
        };
    }

    getSuggestions(partial: string): SearchSuggestion[] {
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
        
        // Add participant suggestions
        for (const participant of this.participantIndex.keys()) {
            if (participant.includes(partialLower)) {
                suggestions.push({
                    type: 'participant',
                    text: `from:${participant}`,
                    count: this.participantIndex.get(participant)!.size
                });
            }
        }
        
        // Add subject suggestions
        for (const subject of this.subjectIndex.keys()) {
            if (subject.includes(partialLower)) {
                suggestions.push({
                    type: 'subject',
                    text: `subject:"${subject}"`,
                    count: this.subjectIndex.get(subject)!.size
                });
            }
        }
        
        return suggestions.slice(0, 10);
    }
}

/**
 * IMAP Search Engine for server-side search
 */
class IMAPSearchEngine {
    private imapConfig: IMAPConfig | null;
    private readonly supportedCriteria: string[];

    constructor(imapConfig?: IMAPConfig) {
        this.imapConfig = imapConfig || null;
        this.supportedCriteria = [
            'ALL', 'ANSWERED', 'BCC', 'BEFORE', 'BODY', 'CC', 'DELETED', 'DRAFT',
            'FLAGGED', 'FROM', 'HEADER', 'KEYWORD', 'LARGER', 'NEW', 'NOT',
            'OLD', 'ON', 'OR', 'RECENT', 'SEEN', 'SENTBEFORE', 'SENTON',
            'SENTONCE', 'SENTSINCE', 'SINCE', 'SMALLER', 'SUBJECT', 'TEXT',
            'TO', 'UID', 'UNANSWERED', 'UNDELETED', 'UNDRAFT', 'UNFLAGGED',
            'UNKEYWORD', 'UNSEEN'
        ];
    }

    async searchIMAP(query: string): Promise<number[]> {
        if (!this.imapConfig) {
            throw new Error('IMAP configuration not available');
        }

        const { Imap } = require('imap');
        
        return new Promise((resolve, reject) => {
            const imap = new Imap({
                user: this.imapConfig!.email || this.imapConfig!.auth?.user,
                password: this.imapConfig!.password || this.imapConfig!.auth?.pass,
                host: this.imapConfig!.imapHost || this.imapConfig!.host,
                port: this.imapConfig!.imapPort || this.imapConfig!.port,
                tls: true,
                tlsOptions: { rejectUnauthorized: false }
            });

            imap.once('ready', () => {
                imap.openBox('INBOX', true, (err: Error | null) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const searchCriteria = this.buildIMAPCriteria(query);
                    console.log('IMAP search criteria:', searchCriteria);

                    imap.search(searchCriteria, (err: Error | null, results: number[]) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        console.log('IMAP search results:', results);
                        imap.end();
                        resolve(results || []);
                    });
                });
            });

            imap.once('error', (err: Error) => {
                console.error('IMAP search error:', err);
                reject(err);
            });

            imap.connect();
        });
    }

    private buildIMAPCriteria(query: string): IMAPSearchCriteria[] {
        const criteria: IMAPSearchCriteria[] = [];
        
        const operatorMappings: OperatorMapping[] = [
            { regex: /from:([^\s]+)/i, imap: 'FROM' },
            { regex: /to:([^\s]+)/i, imap: 'TO' },
            { regex: /subject:([^\s"]+|"[^"]*")/i, imap: 'SUBJECT' },
            { regex: /before:(\d{4}-\d{2}-\d{2})/i, imap: 'BEFORE', transform: (val) => new Date(val) },
            { regex: /after:(\d{4}-\d{2}-\d{2})/i, imap: 'SINCE', transform: (val) => new Date(val) }
        ];
        
        let remainingQuery = query;
        
        operatorMappings.forEach(({ regex, imap, transform }) => {
            const match = query.match(regex);
            if (match) {
                const value = transform ? transform(match[1]) : match[1].replace(/"/g, '');
                criteria.push([imap, value]);
                remainingQuery = remainingQuery.replace(match[0], '').trim();
            }
        });
        
        if (remainingQuery) {
            criteria.push(['TEXT', remainingQuery]);
        }
        
        return criteria.length === 0 ? [['ALL']] : criteria;
    }

    getSupportedCriteria(): string[] {
        return [...this.supportedCriteria];
    }
}

// Global assignment for browser environments
if (typeof window !== 'undefined') {
    (window as any).EmailSearchEngine = EmailSearchEngine;
    (window as any).IMAPSearchEngine = IMAPSearchEngine;
}

// ES Module exports for modern bundlers like Vite
export { EmailSearchEngine, IMAPSearchEngine };
export default EmailSearchEngine; 