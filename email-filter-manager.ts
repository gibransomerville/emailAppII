/**
 * Email Filter Manager
 * Handles filtering and categorization of emails (marketing vs regular)
 * Dependencies: Email types, EmailManager
 */

import { Email } from './types/email.js';

export interface EmailFilter {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    criteria: FilterCriteria;
}

export interface FilterCriteria {
    type: 'unsubscribe' | 'marketing_keywords' | 'sender_domain' | 'subject_pattern' | 'content_pattern';
    value: string | string[];
    operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
    caseSensitive?: boolean;
}

export interface EmailCategory {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
}

export interface FilterResult {
    category: EmailCategory;
    confidence: number;
    reasons: string[];
    matchedCriteria: string[];
}

class EmailFilterManager {
    private filters: EmailFilter[] = [];
    private categories: EmailCategory[] = [];
    private unsubscribePatterns: string[] = [];
    private marketingKeywords: string[] = [];
    private marketingDomains: string[] = [];

    constructor() {
        this.initializeDefaultCategories();
        this.initializeDefaultFilters();
        this.initializePatterns();
    }

    /**
     * Initialize default email categories
     */
    private initializeDefaultCategories(): void {
        this.categories = [
            {
                id: 'marketing',
                name: 'Marketing',
                description: 'Promotional and marketing emails',
                color: '#ff6b6b',
                icon: 'fas fa-bullhorn'
            },
            {
                id: 'newsletter',
                name: 'Newsletter',
                description: 'Newsletters and updates',
                color: '#4ecdc4',
                icon: 'fas fa-newspaper'
            },
            {
                id: 'transactional',
                name: 'Transactional',
                description: 'Receipts, confirmations, and account updates',
                color: '#45b7d1',
                icon: 'fas fa-receipt'
            },
            {
                id: 'social',
                name: 'Social',
                description: 'Social media notifications',
                color: '#96ceb4',
                icon: 'fas fa-share-alt'
            },
            {
                id: 'personal',
                name: 'Personal',
                description: 'Personal correspondence',
                color: '#feca57',
                icon: 'fas fa-user'
            },
            {
                id: 'other',
                name: 'Other',
                description: 'Other emails',
                color: '#6c5ce7',
                icon: 'fas fa-envelope'
            }
        ];
    }

    /**
     * Initialize default filters
     */
    private initializeDefaultFilters(): void {
        this.filters = [
            {
                id: 'unsubscribe_filter',
                name: 'Unsubscribe Detection',
                description: 'Detects emails with unsubscribe links',
                enabled: true,
                criteria: {
                    type: 'unsubscribe',
                    value: 'unsubscribe',
                    operator: 'contains',
                    caseSensitive: false
                }
            },
            {
                id: 'marketing_keywords_filter',
                name: 'Marketing Keywords',
                description: 'Detects marketing emails by keywords',
                enabled: true,
                criteria: {
                    type: 'marketing_keywords',
                    value: ['offer', 'deal', 'discount', 'sale', 'promotion', 'limited time', 'special'],
                    operator: 'contains',
                    caseSensitive: false
                }
            },
            {
                id: 'newsletter_filter',
                name: 'Newsletter Detection',
                description: 'Detects newsletter emails',
                enabled: true,
                criteria: {
                    type: 'content_pattern',
                    value: 'newsletter|weekly|monthly|digest',
                    operator: 'regex',
                    caseSensitive: false
                }
            }
        ];
    }

    /**
     * Initialize common patterns for email categorization
     */
    private initializePatterns(): void {
        // Unsubscribe patterns
        this.unsubscribePatterns = [
            'unsubscribe',
            'opt-out',
            'opt out',
            'remove from list',
            'remove me',
            'stop receiving',
            'cancel subscription',
            'manage preferences',
            'email preferences',
            'preference center'
        ];

        // Marketing keywords
        this.marketingKeywords = [
            'offer',
            'deal',
            'discount',
            'sale',
            'promotion',
            'limited time',
            'special',
            'exclusive',
            'free',
            'save',
            'buy now',
            'shop now',
            'order now',
            'act now',
            'don\'t miss out',
            'last chance',
            'expires',
            'limited offer',
            'flash sale',
            'clearance'
        ];

        // Common marketing domains
        this.marketingDomains = [
            'mailchimp.com',
            'constantcontact.com',
            'campaignmonitor.com',
            'sendgrid.com',
            'klaviyo.com',
            'convertkit.com',
            'mailerlite.com',
            'aweber.com',
            'getresponse.com',
            'activecampaign.com'
        ];
    }

    /**
     * Categorize an email based on its content and metadata
     * @param email - Email object to categorize
     * @returns FilterResult with category and confidence
     */
    categorizeEmail(email: Email): FilterResult {
        const results: FilterResult[] = [];
        
        // Check each filter
        for (const filter of this.filters) {
            if (!filter.enabled) continue;
            
            const result = this.applyFilter(email, filter);
            if (result) {
                results.push(result);
            }
        }

        // Determine the best category based on confidence scores
        if (results.length === 0) {
            const defaultCategory = this.getDefaultCategory();
            return {
                category: defaultCategory,
                confidence: 0.1,
                reasons: ['No specific category detected'],
                matchedCriteria: []
            };
        }

        // Sort by confidence and return the highest
        results.sort((a, b) => b.confidence - a.confidence);
        return results[0];
    }

    /**
     * Apply a specific filter to an email
     * @param email - Email object
     * @param filter - Filter to apply
     * @returns FilterResult or null if no match
     */
    private applyFilter(email: Email, filter: EmailFilter): FilterResult | null {
        const { criteria } = filter;
        let matched = false;
        let confidence = 0;
        const reasons: string[] = [];
        const matchedCriteria: string[] = [];

        switch (criteria.type) {
            case 'unsubscribe':
                matched = this.checkUnsubscribePatterns(email);
                if (matched) {
                    confidence = 0.9;
                    reasons.push('Contains unsubscribe link or text');
                    matchedCriteria.push('unsubscribe');
                }
                break;

            case 'marketing_keywords':
                const keywordMatches = this.checkMarketingKeywords(email);
                if (keywordMatches.length > 0) {
                    matched = true;
                    confidence = Math.min(0.8, keywordMatches.length * 0.2);
                    reasons.push(`Contains marketing keywords: ${keywordMatches.join(', ')}`);
                    matchedCriteria.push(...keywordMatches);
                }
                break;

            case 'sender_domain':
                matched = this.checkSenderDomain(email, criteria.value as string);
                if (matched) {
                    confidence = 0.7;
                    reasons.push(`Sender domain matches: ${criteria.value}`);
                    matchedCriteria.push('sender_domain');
                }
                break;

            case 'subject_pattern':
                matched = this.checkSubjectPattern(email, criteria.value as string, criteria.operator);
                if (matched) {
                    confidence = 0.6;
                    reasons.push(`Subject matches pattern: ${criteria.value}`);
                    matchedCriteria.push('subject_pattern');
                }
                break;

            case 'content_pattern':
                matched = this.checkContentPattern(email, criteria.value as string, criteria.operator);
                if (matched) {
                    confidence = 0.5;
                    reasons.push(`Content matches pattern: ${criteria.value}`);
                    matchedCriteria.push('content_pattern');
                }
                break;
        }

        if (!matched) return null;

        // Determine category based on filter type
        let category: EmailCategory;
        switch (criteria.type) {
            case 'unsubscribe':
            case 'marketing_keywords':
                category = this.getCategoryById('marketing');
                break;
            case 'content_pattern':
                if (criteria.value.toString().includes('newsletter')) {
                    category = this.getCategoryById('newsletter');
                } else {
                    category = this.getCategoryById('marketing');
                }
                break;
            default:
                category = this.getCategoryById('other');
        }

        return {
            category,
            confidence,
            reasons,
            matchedCriteria
        };
    }

    /**
     * Check for unsubscribe patterns in email content
     * @param email - Email object
     * @returns True if unsubscribe patterns found
     */
    private checkUnsubscribePatterns(email: Email): boolean {
        const content = this.getEmailContent(email).toLowerCase();
        
        return this.unsubscribePatterns.some(pattern => 
            content.includes(pattern.toLowerCase())
        );
    }

    /**
     * Check for marketing keywords in email content
     * @param email - Email object
     * @returns Array of matched keywords
     */
    private checkMarketingKeywords(email: Email): string[] {
        const content = this.getEmailContent(email).toLowerCase();
        const matches: string[] = [];

        this.marketingKeywords.forEach(keyword => {
            if (content.includes(keyword.toLowerCase())) {
                matches.push(keyword);
            }
        });

        return matches;
    }

    /**
     * Check sender domain against known marketing domains
     * @param email - Email object
     * @param domain - Domain to check
     * @returns True if domain matches
     */
    private checkSenderDomain(email: Email, domain: string): boolean {
        const senderEmail = typeof email.from === 'string' ? email.from : email.from?.email || '';
        const emailDomain = senderEmail.split('@')[1]?.toLowerCase();
        
        return emailDomain === domain.toLowerCase() || 
               this.marketingDomains.includes(emailDomain);
    }

    /**
     * Check subject line against pattern
     * @param email - Email object
     * @param pattern - Pattern to match
     * @param operator - Comparison operator
     * @returns True if pattern matches
     */
    private checkSubjectPattern(email: Email, pattern: string, operator: string): boolean {
        const subject = (email.subject || '').toLowerCase();
        const patternLower = pattern.toLowerCase();

        switch (operator) {
            case 'contains':
                return subject.includes(patternLower);
            case 'equals':
                return subject === patternLower;
            case 'starts_with':
                return subject.startsWith(patternLower);
            case 'ends_with':
                return subject.endsWith(patternLower);
            case 'regex':
                try {
                    const regex = new RegExp(patternLower, 'i');
                    return regex.test(subject);
                } catch {
                    return false;
                }
            default:
                return false;
        }
    }

    /**
     * Check email content against pattern
     * @param email - Email object
     * @param pattern - Pattern to match
     * @param operator - Comparison operator
     * @returns True if pattern matches
     */
    private checkContentPattern(email: Email, pattern: string, operator: string): boolean {
        const content = this.getEmailContent(email).toLowerCase();
        const patternLower = pattern.toLowerCase();

        switch (operator) {
            case 'contains':
                return content.includes(patternLower);
            case 'equals':
                return content === patternLower;
            case 'starts_with':
                return content.startsWith(patternLower);
            case 'ends_with':
                return content.endsWith(patternLower);
            case 'regex':
                try {
                    const regex = new RegExp(patternLower, 'i');
                    return regex.test(content);
                } catch {
                    return false;
                }
            default:
                return false;
        }
    }

    /**
     * Get all email content for analysis
     * @param email - Email object
     * @returns Combined email content
     */
    private getEmailContent(email: Email): string {
        const parts: string[] = [];
        
        if (email.subject) parts.push(email.subject);
        if (email.body) parts.push(email.body);
        if (email.bodyText) parts.push(email.bodyText);
        if (email.bodyHtml) parts.push(email.bodyHtml);
        
        return parts.join(' ');
    }

    /**
     * Get category by ID
     * @param id - Category ID
     * @returns EmailCategory or default category
     */
    private getCategoryById(id: string): EmailCategory {
        return this.categories.find(cat => cat.id === id) || this.getDefaultCategory();
    }

    /**
     * Get default category
     * @returns Default email category
     */
    private getDefaultCategory(): EmailCategory {
        return this.categories.find(cat => cat.id === 'other') || {
            id: 'other',
            name: 'Other',
            description: 'Other emails',
            color: '#6c5ce7',
            icon: 'fas fa-envelope'
        };
    }

    /**
     * Get all available categories
     * @returns Array of email categories
     */
    getCategories(): EmailCategory[] {
        return [...this.categories];
    }

    /**
     * Get all available filters
     * @returns Array of email filters
     */
    getFilters(): EmailFilter[] {
        return [...this.filters];
    }

    /**
     * Add a new filter
     * @param filter - Filter to add
     */
    addFilter(filter: EmailFilter): void {
        this.filters.push(filter);
    }

    /**
     * Update an existing filter
     * @param filterId - Filter ID
     * @param updates - Filter updates
     */
    updateFilter(filterId: string, updates: Partial<EmailFilter>): void {
        const index = this.filters.findIndex(f => f.id === filterId);
        if (index !== -1) {
            this.filters[index] = { ...this.filters[index], ...updates };
        }
    }

    /**
     * Remove a filter
     * @param filterId - Filter ID
     */
    removeFilter(filterId: string): void {
        this.filters = this.filters.filter(f => f.id !== filterId);
    }

    /**
     * Enable or disable a filter
     * @param filterId - Filter ID
     * @param enabled - Enable status
     */
    setFilterEnabled(filterId: string, enabled: boolean): void {
        const filter = this.filters.find(f => f.id === filterId);
        if (filter) {
            filter.enabled = enabled;
        }
    }

    /**
     * Get statistics about email categorization
     * @param emails - Array of emails
     * @returns Categorization statistics
     */
    getCategorizationStats(emails: Email[]): Record<string, number> {
        const stats: Record<string, number> = {};
        
        // Initialize stats for all categories
        this.categories.forEach(cat => {
            stats[cat.id] = 0;
        });

        // Count emails in each category
        emails.forEach(email => {
            const result = this.categorizeEmail(email);
            stats[result.category.id]++;
        });

        return stats;
    }
}

// Export for module systems
export { EmailFilterManager };

console.log('EmailFilterManager module loaded successfully'); 