/**
 * Gmail-Style Email Processor
 * Implements Gmail's specific email processing patterns and quirks
 * Based on Gmail's actual email rendering behavior
 */

import { Email } from '../../types/email';
import { MarketingEmailDetector } from '../email/marketing-email-detector.js';

// Gmail-specific processing interfaces
interface GmailProcessingOptions {
  preserveGmailStructure: boolean;
  handleGmailQuirks: boolean;
  applyGmailStyling: boolean;
  processGmailTables: boolean;
  sanitizeGmailContent: boolean;
  enableGmailResponsive: boolean;
  removeSignatures?: boolean; // New option for signature removal
}

interface GmailProcessedResult {
  content: string;
  warnings: string[];
  processingSteps: string[];
  gmailFeatures: {
    hasGmailWrappers: boolean;
    hasGmailTables: boolean;
    hasGmailImages: boolean;
    hasGmailStyles: boolean;
  };
}

// Signature detection patterns and helpers
const SIGNATURE_SEPARATORS = [
    /^-- ?$/m, // Standard signature separator
];
const SIGNATURE_PHRASES = [
    'best regards', 'regards', 'kind regards', 'thanks', 'thank you', 'cheers',
    'sent from my iphone', 'sent from my ipad', 'sent from my android',
    'sent from my mobile', 'sent from my phone', 'sincerely', 'yours truly',
    'yours faithfully', 'yours sincerely', 'warm regards', 'with appreciation',
    'with gratitude', 'respectfully', 'cordially', 'take care', 'ciao',
    'saludos', 'mit freundlichen grüßen', 'cordialement', 'merci', 'danke',
    'gracias', 'obrigado', 'arigato', 'regards,', 'cheers,', 'thanks,',
];
const SIGNATURE_HTML_CLASSES = [
    'gmail_signature', 'signature', 'outlook-signature', 'msoSignature',
    'email-signature', 'sig', 'mail-signature', 'footer-signature',
];

class GmailStyleProcessor {
  private gmailPatterns = {
    // Gmail wrapper patterns
    gmailWrappers: [
      /<div[^>]*class\s*=\s*["'][^"']*gmail[^"']*["'][^>]*>/gi,
      /<div[^>]*id\s*=\s*["'][^"']*gmail[^"']*["'][^>]*>/gi,
      /<div[^>]*data-gmail[^>]*>/gi
    ],
    
    // Gmail table patterns
    gmailTables: [
      /<table[^>]*class\s*=\s*["'][^"']*gmail[^"']*["'][^>]*>/gi,
      /<table[^>]*style\s*=\s*["'][^"']*width\s*:\s*100%[^"']*["'][^>]*>/gi
    ],
    
    // Gmail image patterns
    gmailImages: [
      /<img[^>]*class\s*=\s*["'][^"']*gmail[^"']*["'][^>]*>/gi,
      /<img[^>]*data-gmail[^>]*>/gi
    ],
    
    // Gmail style patterns
    gmailStyles: [
      /style\s*=\s*["'][^"']*font-family\s*:\s*arial[^"']*["']/gi,
      /style\s*=\s*["'][^"']*font-size\s*:\s*13px[^"']*["']/gi,
      /style\s*=\s*["'][^"']*line-height\s*:\s*1\.4[^"']*["']/gi
    ]
  };

  private marketingDetector = new MarketingEmailDetector();

  /**
   * Main Gmail-style processing entry point
   * @param email - Email object to process
   * @param options - Gmail processing options
   * @returns Gmail-processed result
   */
  processGmailStyle(email: Email, options: Partial<GmailProcessingOptions> = {}): GmailProcessedResult {
    const fullOptions: GmailProcessingOptions = {
      preserveGmailStructure: true,
      handleGmailQuirks: true,
      applyGmailStyling: true,
      processGmailTables: true,
      sanitizeGmailContent: true,
      enableGmailResponsive: true,
      removeSignatures: true, // Enable signature removal by default
      ...options
    };

    const processingSteps: string[] = [];
    const warnings: string[] = [];
    const gmailFeatures = {
      hasGmailWrappers: false,
      hasGmailTables: false,
      hasGmailImages: false,
      hasGmailStyles: false
    };

    // Step 1: Extract content with Gmail priority
    let content = this.extractGmailContent(email);
    processingSteps.push('Extracted Gmail-style content');

    // Step 1.5: Remove signatures from non-marketing emails
    if (fullOptions.removeSignatures) {
      const marketingTag = this.marketingDetector.detectMarketingEmail(email);
      const isMarketing = marketingTag.isMarketing;
      
      if (!isMarketing) {
        const originalContent = content;
        const isHtmlContent = this.isHtmlContent(content);
        
        if (isHtmlContent) {
          content = this.removeSignatureFromHtml(content);
        } else {
          content = this.removeSignatureFromPlainText(content);
        }
        
        if (content !== originalContent) {
          processingSteps.push(`Signature block removed from ${isHtmlContent ? 'HTML' : 'plain text'} (non-marketing email)`);
        }
      } else {
        processingSteps.push('Signature removal skipped (marketing email detected)');
      }
    }

    // Step 2: Detect Gmail-specific features
    gmailFeatures.hasGmailWrappers = this.hasGmailWrappers(content);
    gmailFeatures.hasGmailTables = this.hasGmailTables(content);
    gmailFeatures.hasGmailImages = this.hasGmailImages(content);
    gmailFeatures.hasGmailStyles = this.hasGmailStyles(content);
    processingSteps.push('Detected Gmail features');

    // Step 3: Preserve Gmail structure (Gmail's approach)
    if (fullOptions.preserveGmailStructure && gmailFeatures.hasGmailWrappers) {
      content = this.preserveGmailStructure(content);
      processingSteps.push('Preserved Gmail structure');
    }

    // Step 4: Handle Gmail-specific quirks
    if (fullOptions.handleGmailQuirks) {
      content = this.handleGmailQuirks(content);
      processingSteps.push('Applied Gmail quirks handling');
    }

    // Step 5: Process Gmail tables (Gmail's table approach)
    if (fullOptions.processGmailTables && gmailFeatures.hasGmailTables) {
      content = this.processGmailTables(content);
      processingSteps.push('Processed Gmail tables');
    }

    // Step 6: Apply Gmail styling patterns
    if (fullOptions.applyGmailStyling) {
      content = this.applyGmailStyling(content);
      processingSteps.push('Applied Gmail styling');
    }

    // Step 7: Enable Gmail responsive behavior
    if (fullOptions.enableGmailResponsive) {
      content = this.enableGmailResponsive(content);
      processingSteps.push('Enabled Gmail responsive behavior');
    }

    // Step 8: Gmail-style sanitization (less aggressive than standard)
    if (fullOptions.sanitizeGmailContent) {
      content = this.sanitizeGmailContent(content);
      processingSteps.push('Applied Gmail-style sanitization');
    }

    // Step 9: Wrap in Gmail container
    content = this.wrapInGmailContainer(content);
    processingSteps.push('Wrapped in Gmail container');

    return {
      content,
      warnings,
      processingSteps,
      gmailFeatures
    };
  }

  /**
   * Extract content with Gmail's priority system
   * @param email - Email object
   * @returns Extracted content
   */
  private extractGmailContent(email: Email): string {
    // Gmail's content extraction priority:
    // 1. HTML content (preferred)
    // 2. Text content (fallback)
    // 3. Snippet (preview)
    
    if (email.bodyHtml && email.bodyHtml.trim()) {
      return email.bodyHtml.trim();
    }
    
    if (email.bodyText && email.bodyText.trim()) {
      return this.convertTextToGmailHtml(email.bodyText.trim());
    }
    
    if ((email as any).snippet && (email as any).snippet.trim()) {
      return this.convertTextToGmailHtml((email as any).snippet.trim());
    }
    
    return '<div class="gmail-no-content">No content available</div>';
  }

  /**
   * Convert text to Gmail-style HTML
   * @param text - Plain text
   * @returns Gmail-style HTML
   */
  private convertTextToGmailHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</div><div class="gmail-paragraph">')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<div class="gmail-paragraph">')
      .replace(/$/, '</div>');
  }

  /**
   * Detect Gmail wrapper elements
   * @param content - HTML content
   * @returns True if Gmail wrappers detected
   */
  private hasGmailWrappers(content: string): boolean {
    return this.gmailPatterns.gmailWrappers.some(pattern => pattern.test(content));
  }

  /**
   * Detect Gmail table elements
   * @param content - HTML content
   * @returns True if Gmail tables detected
   */
  private hasGmailTables(content: string): boolean {
    return this.gmailPatterns.gmailTables.some(pattern => pattern.test(content));
  }

  /**
   * Detect Gmail image elements
   * @param content - HTML content
   * @returns True if Gmail images detected
   */
  private hasGmailImages(content: string): boolean {
    return this.gmailPatterns.gmailImages.some(pattern => pattern.test(content));
  }

  /**
   * Detect Gmail style elements
   * @param content - HTML content
   * @returns True if Gmail styles detected
   */
  private hasGmailStyles(content: string): boolean {
    return this.gmailPatterns.gmailStyles.some(pattern => pattern.test(content));
  }

  /**
   * Preserve Gmail structure without breaking it
   * @param content - HTML content
   * @returns Content with preserved Gmail structure
   */
  private preserveGmailStructure(content: string): string {
    let processed = content;

    // Preserve Gmail wrapper divs but ensure they have proper styling
    processed = processed.replace(
      /<div([^>]*class\s*=\s*["'][^"']*gmail[^"']*["'][^>]*)>/gi,
      '<div$1 style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.4;">'
    );

    // Preserve Gmail-specific IDs
    processed = processed.replace(
      /<div([^>]*id\s*=\s*["'][^"']*gmail[^"']*["'][^>]*)>/gi,
      '<div$1 style="font-family: Arial, sans-serif;">'
    );

    return processed;
  }

  /**
   * Handle Gmail-specific quirks and behaviors
   * @param content - HTML content
   * @returns Content with Gmail quirks handled
   */
  private handleGmailQuirks(content: string): string {
    let processed = content;

    // Gmail quirk 1: Preserve table cell spacing
    processed = processed.replace(
      /<td([^>]*?)>/gi,
      (match, attributes) => {
        if (!attributes.includes('style=')) {
          return `<td${attributes} style="padding: 0; margin: 0;">`;
        } else if (!attributes.includes('padding:') && !attributes.includes('margin:')) {
          return match.replace('style="', 'style="padding: 0; margin: 0; ');
        }
        return match;
      }
    );

    // Gmail quirk 2: Handle image display
    processed = processed.replace(
      /<img([^>]*?)>/gi,
      (match, attributes) => {
        if (!attributes.includes('style=')) {
          return `<img${attributes} style="display: block; max-width: 100%; height: auto;">`;
        } else if (!attributes.includes('display:') && !attributes.includes('max-width:')) {
          return match.replace('style="', 'style="display: block; max-width: 100%; height: auto; ');
        }
        return match;
      }
    );

    // Gmail quirk 3: Preserve line breaks in text
    processed = processed.replace(
      /<div([^>]*class\s*=\s*["'][^"']*gmail[^"']*["'][^>]*)>/gi,
      '<div$1 style="white-space: pre-wrap;">'
    );

    return processed;
  }

  /**
   * Process Gmail tables with Gmail's approach
   * @param content - HTML content
   * @returns Content with Gmail table processing
   */
  private processGmailTables(content: string): string {
    let processed = content;

    // Gmail table approach: Add responsive wrapper
    processed = processed.replace(
      /<table([^>]*class\s*=\s*["'][^"']*gmail[^"']*["'][^>]*)>/gi,
      '<div class="gmail-table-wrapper"><table$1>'
    );

    // Close table wrappers
    processed = processed.replace(
      /<\/table>(?=[\s\S]*<div class="gmail-table-wrapper">)/gi,
      '</table></div>'
    );

    // Gmail table cell approach: Only add styles if none exist
    processed = processed.replace(
      /<td([^>]*?)>/gi,
      (match, attributes) => {
        // Only add Gmail styles if no style attribute exists AND no other styling attributes
        if (!attributes.includes('style=') && 
            !attributes.includes('width=') && 
            !attributes.includes('valign=') && 
            !attributes.includes('align=') && 
            !attributes.includes('bgcolor=') && 
            !attributes.includes('class=')) {
          return `<td${attributes} style="display: table-cell; vertical-align: top;">`;
        }
        // If any styling attributes exist, preserve them completely - don't modify
        return match;
      }
    );

    return processed;
  }

  /**
   * Apply Gmail styling patterns - FIXED to preserve original inline styles
   * @param content - HTML content
   * @returns Content with Gmail styling (only when no inline styles exist)
   */
  private applyGmailStyling(content: string): string {
    // FIXED: Only apply Gmail styles when no inline styles exist
    // This preserves original email styling instead of overriding it
    return content.replace(
      /<(div|td|p|span|table|th|tr|tbody|thead|tfoot)([^>]*)>/gi,
      (match, tag, attrs) => {
        // Only add Gmail styles if no style attribute exists
        if (!/style=/.test(attrs)) {
          let style = 'font-family: Arial, sans-serif; font-size: 13px; line-height: 1.4;';
          // Add Gmail-like margin to block elements
          if (['div','td','p','table','th','tr','tbody','thead','tfoot'].includes(tag)) {
            style += ' margin: 0 0 16px 0;';
          }
          return `<${tag}${attrs} style="${style}">`;
        }
        // If style already exists, preserve it completely - don't override
        return match;
      }
    );
  }

  /**
   * Enable Gmail responsive behavior
   * @param content - HTML content
   * @returns Content with Gmail responsive features
   */
  private enableGmailResponsive(content: string): string {
    let processed = content;

    // Gmail responsive approach: Add viewport meta and responsive styles
    const responsiveStyles = `
      <style>
        .gmail-table-wrapper {
          overflow-x: auto;
          max-width: 100%;
        }
        .gmail-table-wrapper table {
          min-width: 100%;
        }
        .gmail-paragraph {
          margin: 0 0 16px 0;
        }
        @media screen and (max-width: 600px) {
          .gmail-table-wrapper table {
            font-size: 12px;
          }
        }
      </style>
    `;

    // Insert responsive styles at the beginning
    processed = responsiveStyles + processed;

    return processed;
  }

  /**
   * Gmail-style sanitization (less aggressive)
   * @param content - HTML content
   * @returns Sanitized content
   */
  private sanitizeGmailContent(content: string): string {
    let processed = content;

    // Gmail's approach: Remove only dangerous elements, preserve structure
    processed = processed.replace(/<script[^>]*>.*?<\/script>/gis, '');
    processed = processed.replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');
    processed = processed.replace(/<object[^>]*>.*?<\/object>/gis, '');
    processed = processed.replace(/<embed[^>]*>/gi, '');

    // Remove dangerous attributes but preserve Gmail ones
    processed = processed.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    processed = processed.replace(/\s*javascript\s*:/gi, '');

    return processed;
  }

  /**
   * Wrap content in Gmail container
   * @param content - HTML content
   * @returns Wrapped content
   */
  private wrapInGmailContainer(content: string): string {
    return `
      <div class="gmail-content" style="
        font-family: Arial, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        color: #333;
        max-width: 100%;
        word-wrap: break-word;
        overflow-wrap: break-word;
      ">
        ${content}
      </div>
    `;
  }

  /**
   * Check if content is HTML
   * @param content - Content to check
   * @returns True if content appears to be HTML
   */
  private isHtmlContent(content: string): boolean {
    return /<[^>]+>/i.test(content);
  }

  /**
   * Remove signature from plain text content
   * @param text - Plain text content
   * @returns Text with signature removed
   */
  private removeSignatureFromPlainText(text: string): string {
    const lines = text.split('\n');
    let cutIndex = lines.length;
    
    // Check for signature separator
    for (let i = 0; i < lines.length; i++) {
      if (SIGNATURE_SEPARATORS.some(sep => sep.test(lines[i]))) {
        cutIndex = i;
        break;
      }
    }
    
    // Check for signature phrases (case-insensitive)
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase().trim();
      if (SIGNATURE_PHRASES.some(phrase => lower.startsWith(phrase))) {
        cutIndex = Math.min(cutIndex, i);
        break;
      }
    }
    
    return lines.slice(0, cutIndex).join('\n').trim();
  }

  /**
   * Remove signature from HTML content
   * @param html - HTML content
   * @returns HTML with signature removed
   */
  private removeSignatureFromHtml(html: string): string {
    // Remove signature blocks by class or id
    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch {
      return html;
    }
    
    let removed = false;
    SIGNATURE_HTML_CLASSES.forEach(cls => {
      // By class
      doc.querySelectorAll(`.${cls}`).forEach(el => { el.remove(); removed = true; });
      // By id
      doc.querySelectorAll(`#${cls}`).forEach(el => { el.remove(); removed = true; });
    });
    
    // Remove <hr> followed by short block (common in Outlook)
    doc.querySelectorAll('hr').forEach(hr => {
      const next = hr.nextElementSibling;
      if (next && next.textContent && next.textContent.length < 300) {
        hr.remove();
        next.remove();
        removed = true;
      }
    });
    
    return removed ? doc.body.innerHTML : html;
  }
}

export { GmailStyleProcessor, type GmailProcessingOptions, type GmailProcessedResult }; 