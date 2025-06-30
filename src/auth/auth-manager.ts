/**
 * Authentication Manager Module
 * Handles OAuth flows, token management, and authentication state
 * Dependencies: ipcRenderer (electron), UIThemeManager, EventManager, IMAPEmailManager
 */

// Removed googleapis import - using IPC communication instead
import { UIThemeManager } from '../ui/ui-theme-manager.js';
import { EventManager } from '../managers/event-manager.js';
import { IMAPEmailManager } from '../email/imap-email-manager.js';
import type { IpcRenderer } from 'electron';

// Get ipcRenderer from window
const ipcRenderer = (window as any).require('electron').ipcRenderer as IpcRenderer;

// Google OAuth interfaces
export interface GoogleOAuthCredentials {
    access_token: string;
    refresh_token?: string;
    scope: string;
    token_type: string;
    expiry_date?: number;
}

interface TokenLoadResult {
    success: boolean;
    token?: GoogleOAuthCredentials;
}

interface TokenSaveResult {
    success: boolean;
}

interface AuthStatus {
    isAuthenticated: boolean;
    hasStoredToken: boolean;
    tokenExpiry: number | null;
    isTokenExpired: boolean;
}

interface GoogleAuthValidationResult {
    success: boolean;
    valid?: boolean;
    error?: string;
}

/**
 * Authentication Manager - Handles OAuth and credential management
 */
export class AuthManager {
    private static uiThemeManager: UIThemeManager | null = null;
    private static imapEmailManager: IMAPEmailManager | null = null;
    private static currentToken: GoogleOAuthCredentials | null = null;

    /**
     * Initialize the AuthManager with required dependencies
     */
    static initialize(
        uiThemeManager: UIThemeManager, 
        _eventManager: EventManager,
        imapEmailManager: IMAPEmailManager
    ): void {
        this.uiThemeManager = uiThemeManager;
        this.imapEmailManager = imapEmailManager;
        // eventManager parameter available for future use
        void _eventManager;
        console.log('AuthManager initialized with dependencies');
        
        // Try to load stored token
        this.loadStoredGoogleToken();
    }



    /**
     * Refresh Google OAuth token if needed
     * @param forceRefresh - Force token refresh
     * @returns True if token is valid
     */
    static async refreshTokenIfNeeded(forceRefresh: boolean = false): Promise<boolean> {
        if (!this.currentToken) {
            console.log('AuthManager: No current token available');
            return false;
        }

        try {
            // Check if token is expired or will expire soon (within 5 minutes)
            const expiryDate = this.currentToken.expiry_date;
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            if (forceRefresh || (expiryDate && now >= (expiryDate - fiveMinutes))) {
                console.log('AuthManager: Refreshing access token via IPC...');
                
                const result = await ipcRenderer.invoke('refresh-google-token', this.currentToken);
                
                if (result.success && result.token) {
                    this.currentToken = result.token;
                    console.log('AuthManager: Token refreshed successfully');
                    return true;
                } else {
                    console.error('AuthManager: Token refresh failed:', result.error);
                    return false;
                }
            }

            console.log('AuthManager: Token is still valid');
            return true;
        } catch (error) {
            console.error('AuthManager: Error refreshing token:', error);
            return false;
        }
    }

    /**
     * Show OAuth loading modal
     * @param provider - OAuth provider
     */
    static showOAuthLoadingModal(provider: 'google' | 'microsoft' = 'google'): void {
        console.log(`AuthManager: Showing OAuth loading modal for ${provider}`);
        
        const modal = document.getElementById('oauth-loading-modal');
        if (modal) {
            modal.classList.add('show');
            console.log('AuthManager: OAuth loading modal shown');
        } else {
            console.error('AuthManager: OAuth loading modal element not found');
        }
    }

    /**
     * Hide OAuth loading modal
     */
    static hideOAuthLoadingModal(): void {
        console.log('AuthManager: Hiding OAuth loading modal');
        
        const modal = document.getElementById('oauth-loading-modal');
        if (modal) {
            modal.classList.remove('show');
            console.log('AuthManager: OAuth loading modal hidden');
        } else {
            console.error('AuthManager: OAuth loading modal element not found');
        }
    }

    /**
     * Update OAuth progress
     * @param percentage - Progress percentage
     * @param text - Progress text
     */
    static updateOAuthProgress(percentage: number, text: string): void {
        const progressFill = document.getElementById('oauth-progress-fill');
        const progressText = document.getElementById('oauth-progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = text;
        }
        
        console.log(`AuthManager: OAuth progress ${percentage}% - ${text}`);
    }

    /**
     * Update OAuth step status
     * @param stepNumber - Step number
     * @param status - Step status
     */
    static updateOAuthStep(stepNumber: number, status: string = 'active'): void {
        const stepElement = document.querySelector(`.oauth-step-${stepNumber}`);
        if (stepElement) {
            stepElement.className = `oauth-step oauth-step-${stepNumber} ${status}`;
        }
        
        console.log(`AuthManager: OAuth step ${stepNumber} status: ${status}`);
    }

    /**
     * Reset OAuth steps
     */
    static resetOAuthSteps(): void {
        document.querySelectorAll('.oauth-step').forEach(step => {
            step.className = 'oauth-step';
        });
        
        console.log('AuthManager: OAuth steps reset');
    }

    /**
     * Handle Google SSO authentication flow
     */
    static async handleGoogleSSO(): Promise<void> {
        console.log('AuthManager: Google SSO requested');
        
        if (!this.uiThemeManager) {
            console.error('UI Theme Manager not initialized');
            return;
        }

        try {
            // Show OAuth loading modal with progress tracking
            this.uiThemeManager.showOAuthLoadingModal('google');
            
            // Update progress - Step 1
            this.uiThemeManager.updateOAuthProgress(25, 'Opening sign-in window...');
            
            // Request OAuth via IPC
            const result = await ipcRenderer.invoke('google-sso');
            
            if (result.success) {
                console.log('AuthManager: OAuth successful');
                
                // Update progress - Step 3
                this.uiThemeManager.updateOAuthProgress(75, 'Verifying permissions...');
                
                // Store the token and set credentials
                await this.saveGoogleToken(result.token);
                this.currentToken = result.token;
                
                // Set Google auth in IMAP manager if available
                if (this.imapEmailManager) {
                    this.imapEmailManager.setGoogleAuth(result.token);
                    
                    // **CRITICAL: Directly trigger email loading in the same module**
                    console.log('AuthManager: Triggering email loading...');
                    this.uiThemeManager.updateOAuthProgress(90, 'Loading emails...');
                    
                    try {
                        const emailResult = await this.imapEmailManager.loadEmails();
                        
                                                 if (emailResult.success) {
                            console.log(`AuthManager: Successfully loaded ${emailResult.emails.length} emails in ${Object.keys(emailResult.conversations).length} conversations`);
                            
                            // Final progress update
                            const uiManager = this.uiThemeManager;
                            if (uiManager) {
                                uiManager.updateOAuthProgress(100, 'Complete!');
                                
                                // Hide loading modal and show success
                                setTimeout(() => {
                                    if (uiManager) {
                                        uiManager.hideOAuthLoadingModal();
                                        uiManager.showNotification(
                                            `Successfully connected! Loaded ${emailResult.emails.length} emails.`, 
                                            'success'
                                        );
                                    }
                                }, 500);
                            }
                            
                        } else {
                            console.error('AuthManager: Email loading failed:', emailResult.error);
                            const uiManager = this.uiThemeManager;
                            if (uiManager) {
                                uiManager.hideOAuthLoadingModal();
                                uiManager.showNotification('Failed to load emails: ' + emailResult.error, 'error');
                            }
                        }
                    } catch (emailError) {
                        console.error('AuthManager: Error loading emails:', emailError);
                        const uiManager = this.uiThemeManager;
                        if (uiManager) {
                            uiManager.hideOAuthLoadingModal();
                            uiManager.showNotification('Failed to load emails after authentication', 'error');
                        }
                    }
                } else {
                    console.warn('AuthManager: IMAPEmailManager not available');
                    const uiManager = this.uiThemeManager;
                    if (uiManager) {
                        uiManager.updateOAuthProgress(100, 'Authentication complete');
                        setTimeout(() => {
                            if (uiManager) {
                                uiManager.hideOAuthLoadingModal();
                                uiManager.showNotification('Successfully connected to Google!', 'success');
                            }
                        }, 500);
                    }
                }
                
            } else {
                console.error('AuthManager: OAuth failed:', result.error);
                this.uiThemeManager.hideOAuthLoadingModal();
                this.uiThemeManager.showNotification('Google authentication failed: ' + result.error, 'error');
            }
            
        } catch (error) {
            console.error('AuthManager: OAuth error:', error);
            this.uiThemeManager.hideOAuthLoadingModal();
            this.uiThemeManager.showNotification('Authentication failed: ' + (error as Error).message, 'error');
        }
    }

    /**
     * Load stored Google OAuth token
     * @returns True if token loaded successfully
     */
    static async loadStoredGoogleToken(): Promise<boolean> {
        try {
            const result: TokenLoadResult = await ipcRenderer.invoke('load-google-token');
            if (result.success && result.token) {
                this.currentToken = result.token;
                console.log('Stored Google token loaded');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error loading stored Google token:', error);
            return false;
        }
    }

    /**
     * Save Google OAuth token
     * @param token - OAuth token object
     * @returns True if token saved successfully
     */
    static async saveGoogleToken(token: GoogleOAuthCredentials): Promise<boolean> {
        try {
            const result: TokenSaveResult = await ipcRenderer.invoke('save-google-token', token);
            if (result.success) {
                this.currentToken = token;
                console.log('Google token saved successfully');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error saving Google token:', error);
            return false;
        }
    }

    /**
     * Validate Google OAuth token scopes
     * @returns True if token has required permissions
     */
    static async validateGoogleTokenScopes(): Promise<boolean> {
        if (!this.currentToken) return false;
        
        try {
            // Use IPC to validate token in main process
            const result: GoogleAuthValidationResult = await ipcRenderer.invoke('validate-google-token', this.currentToken);
            return result.success && result.valid === true;
        } catch (error: any) {
            console.warn('Token validation failed:', error);
            return false;
        }
    }

    /**
     * Clear all authentication data
     */
    static async clearAuthData(): Promise<void> {
        try {
            this.currentToken = null;
            await ipcRenderer.invoke('clear-google-token');
            console.log('Authentication data cleared');
        } catch (error) {
            console.error('Error clearing auth data:', error);
        }
    }

    /**
     * Check if user is authenticated
     * @returns True if authenticated
     */
    static isAuthenticated(): boolean {
        return !!this.currentToken;
    }

    /**
     * Get current authentication status
     * @returns Authentication status object
     */
    static getAuthStatus(): AuthStatus {
        return {
            isAuthenticated: this.isAuthenticated(),
            hasStoredToken: !!this.currentToken,
            tokenExpiry: this.currentToken?.expiry_date || null,
            isTokenExpired: this.currentToken?.expiry_date ? 
                Date.now() >= (this.currentToken.expiry_date - 60000) : false
        };
    }

    /**
     * Get current Google token (for IPC usage)
     * @returns Current Google OAuth token
     */
    static getCurrentToken(): GoogleOAuthCredentials | null {
        return this.currentToken;
    }
}

console.log('AuthManager module loaded successfully (IPC-based)'); 