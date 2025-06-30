/**
 * Marketing Email Detector
 * Simple utility to detect and tag marketing emails with visual indicators
 */

import { Email } from '../../types/email';

export interface MarketingTag {
    isMarketing: boolean;
    confidence: number;
    reasons: string[];
    tagClass: string;
    tagText: string;
    tagColor: string;
}

class MarketingEmailDetector {
    private unsubscribePatterns: string[] = [
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

    private marketingKeywords: string[] = [
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

    private marketingDomains: string[] = [
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

    /**
     * Detect if an email is marketing and return tag information
     * @param email - Email object to analyze
     * @returns MarketingTag with detection results
     */
    detectMarketingEmail(email: Email): MarketingTag {
        const reasons: string[] = [];
        let confidence = 0;

        // Check for unsubscribe patterns (highest confidence)
        if (this.hasUnsubscribePattern(email)) {
            confidence += 0.8;
            reasons.push('Contains unsubscribe link');
        }

        // Check for marketing keywords
        const keywordMatches = this.findMarketingKeywords(email);
        if (keywordMatches.length > 0) {
            confidence += Math.min(0.6, keywordMatches.length * 0.15);
            reasons.push(`Marketing keywords: ${keywordMatches.join(', ')}`);
        }

        // Check sender domain
        if (this.isMarketingDomain(email)) {
            confidence += 0.5;
            reasons.push('Marketing service domain');
        }

        // Determine if it's marketing
        const isMarketing = confidence >= 0.3;

        return {
            isMarketing,
            confidence: Math.min(confidence, 1.0),
            reasons,
            tagClass: isMarketing ? 'marketing-tag' : '',
            tagText: isMarketing ? 'Marketing' : '',
            tagColor: isMarketing ? '#ff6b6b' : ''
        };
    }

    /**
     * Check if email contains unsubscribe patterns
     * @param email - Email object
     * @returns True if unsubscribe patterns found
     */
    private hasUnsubscribePattern(email: Email): boolean {
        const content = this.getEmailContent(email).toLowerCase();
        return this.unsubscribePatterns.some(pattern => 
            content.includes(pattern.toLowerCase())
        );
    }

    /**
     * Find marketing keywords in email content
     * @param email - Email object
     * @returns Array of matched keywords
     */
    private findMarketingKeywords(email: Email): string[] {
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
     * Check if sender domain is a known marketing service
     * @param email - Email object
     * @returns True if marketing domain
     */
    private isMarketingDomain(email: Email): boolean {
        const senderEmail = typeof email.from === 'string' ? email.from : email.from?.email || '';
        const emailDomain = senderEmail.split('@')[1]?.toLowerCase();
        
        return emailDomain ? this.marketingDomains.includes(emailDomain) : false;
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
     * Add marketing tag to email element
     * @param emailElement - Email DOM element
     * @param tag - Marketing tag information
     */
    addMarketingTagToElement(emailElement: HTMLElement, tag: MarketingTag): void {
        if (!tag.isMarketing) return;

        // Remove existing tag if present
        const existingTag = emailElement.querySelector('.marketing-tag');
        if (existingTag) {
            existingTag.remove();
        }

        // Create new tag
        const tagElement = document.createElement('div');
        tagElement.className = 'marketing-tag';
        tagElement.textContent = tag.tagText;
        tagElement.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background-color: ${tag.tagColor};
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;

        // Add tooltip with reasons
        if (tag.reasons.length > 0) {
            tagElement.title = `Marketing detected: ${tag.reasons.join(', ')}`;
        }

        // Make sure email element has relative positioning
        if (getComputedStyle(emailElement).position === 'static') {
            emailElement.style.position = 'relative';
        }

        emailElement.appendChild(tagElement);
    }

    /**
     * Process all emails in a conversation and add marketing tags
     * @param emailsContainer - Container with email elements
     */
    processEmailsInContainer(emailsContainer: HTMLElement): void {
        const emailElements = emailsContainer.querySelectorAll('.email-item');
        
        emailElements.forEach(emailElement => {
            const messageId = emailElement.getAttribute('data-message-id');
            if (!messageId) return;

            // Find the email data (you'll need to implement this based on your data structure)
            const email = this.findEmailByMessageId(messageId);
            if (!email) return;

            const tag = this.detectMarketingEmail(email);
            this.addMarketingTagToElement(emailElement as HTMLElement, tag);
        });
    }

    /**
     * Find email by message ID (placeholder - implement based on your data structure)
     * @returns Email object or null
     */
    private findEmailByMessageId(_messageId: string): Email | null {
        // This is a placeholder - you'll need to implement this based on how you store emails
        // For now, return null and let the calling code handle it
        return null;
    }
}

// Export for module systems
export { MarketingEmailDetector };

console.log('MarketingEmailDetector module loaded successfully'); 