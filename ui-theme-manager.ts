/**
 * UI & Theme Management Module
 * Handles all UI state management, theme switching, modal controls, loading states, and notifications
 */

export type Theme = 'light' | 'dark';

interface DOMElements {
    composeModal?: HTMLElement | null;
    settingsModal?: HTMLElement | null;
    oauthLoadingModal?: HTMLElement | null;
    loadingOverlay?: HTMLElement | null;
    oauthProgressFill?: HTMLElement | null;
    oauthProgressText?: HTMLElement | null;
    oauthProviderIcon?: HTMLElement | null;
    oauthLoadingTitle?: HTMLElement | null;
    composeForm?: HTMLFormElement | null;
    toInput?: HTMLInputElement | null;
    ccInput?: HTMLInputElement | null;
    subjectInput?: HTMLInputElement | null;
    bodyInput?: HTMLTextAreaElement | null;
}

export class UIThemeManager {
    private domElements: DOMElements;
    private theme: string = 'light';
    private initialized: boolean = false;

    constructor() {
        this.domElements = {};
        this.initialize();
    }

    initialize(): void {
        if (this.initialized) {
            return;
        }

        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.theme = savedTheme;
        }

        // Apply theme
        this.applyTheme();

        // Initialize UI elements
        this.initializeModals();
        this.initializeToasts();
        this.initializeLoadingIndicator();

        this.initialized = true;
    }

    private applyTheme(): void {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
    }

    private initializeModals(): void {
        // Initialize modal containers if they don't exist
        ['oauth-modal', 'settings-modal', 'compose-modal'].forEach(id => {
            if (!document.getElementById(id)) {
                const modal = document.createElement('div');
                modal.id = id;
                modal.className = 'modal';
                modal.style.display = 'none';
                document.body.appendChild(modal);
            }
        });
    }

    private initializeToasts(): void {
        // Initialize toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }

    private initializeLoadingIndicator(): void {
        // Initialize loading indicator if it doesn't exist
        if (!document.getElementById('loading-indicator')) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'loading-indicator';
            loadingIndicator.style.display = 'none';
            document.body.appendChild(loadingIndicator);
        }
    }

    showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            console.error('Toast container not found');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 300);
        }, 3000);
    }

    showLoading(show: boolean): void {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'block' : 'none';
        }
    }

    showOAuthLoadingModal(provider: 'google' | 'microsoft'): void {
        console.log(`UIThemeManager: Showing OAuth loading modal for ${provider}`);
        const modal = document.getElementById('oauth-loading-modal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
            modal.style.zIndex = '10001'; // Higher than settings modal
            
            // Update provider-specific content
            const providerIcon = document.getElementById('oauth-provider-icon');
            const loadingTitle = document.getElementById('oauth-loading-title');
            
            if (providerIcon) {
                providerIcon.className = provider === 'google' ? 'fab fa-google' : 'fab fa-microsoft';
            }
            
            if (loadingTitle) {
                loadingTitle.textContent = `Connecting to ${provider === 'google' ? 'Google' : 'Microsoft'}`;
            }
            
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);
            
            console.log(`UIThemeManager: OAuth loading modal shown for ${provider}`);
        } else {
            console.error('UIThemeManager: OAuth loading modal element not found');
        }
    }

    hideOAuthLoadingModal(): void {
        console.log('UIThemeManager: Hiding OAuth loading modal');
        const modal = document.getElementById('oauth-loading-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            console.log('UIThemeManager: OAuth loading modal hidden');
        } else {
            console.error('UIThemeManager: OAuth loading modal element not found');
        }
    }

    updateOAuthStep(step: number, status: 'active' | 'completed' | 'error'): void {
        const stepElement = document.getElementById(`oauth-step-${step}`);
        if (stepElement) {
            stepElement.className = `step ${status}`;
        }
    }

    updateOAuthProgress(percent: number, message: string): void {
        const progressBar = document.getElementById('oauth-progress');
        const statusText = document.getElementById('oauth-status');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        if (statusText) {
            statusText.textContent = message;
        }
    }

    resetOAuthSteps(): void {
        for (let i = 1; i <= 3; i++) {
            this.updateOAuthStep(i, 'active');
        }
        this.updateOAuthProgress(0, 'Starting...');
    }

    showSettingsModal(): void {
        console.log('=== UIThemeManager: showSettingsModal called ===');
        const modal = document.getElementById('settings-modal');
        console.log('UIThemeManager: Modal element found:', !!modal);
        console.log('UIThemeManager: Modal element:', modal);
        
        if (modal) {
            console.log('UIThemeManager: Modal current state:', {
                display: modal.style.display,
                className: modal.className,
                offsetParent: modal.offsetParent,
                visibility: getComputedStyle(modal).visibility
            });
            
            // Force show the modal with multiple approaches
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            modal.classList.add('show');
            modal.style.zIndex = '10000';
            modal.style.position = 'fixed';
            
            console.log('UIThemeManager: Modal after changes:', {
                display: modal.style.display,
                className: modal.className,
                visibility: modal.style.visibility,
                opacity: modal.style.opacity,
                zIndex: modal.style.zIndex
            });
            
            // Test if modal is actually visible
            const rect = modal.getBoundingClientRect();
            console.log('UIThemeManager: Modal bounds:', rect);
            
            console.log('=== UIThemeManager: Settings modal should now be visible ===');
        } else {
            console.error('UIThemeManager: Settings modal element not found');
            
            // Try alternative searches
            const modalByClass = document.querySelector('.modal');
            const allModals = document.querySelectorAll('.modal');
            console.log('UIThemeManager: Found modal by class:', !!modalByClass);
            console.log('UIThemeManager: All modals found:', allModals.length);
        }
    }

    hideSettingsModal(): void {
        console.log('UIThemeManager: Hiding settings modal');
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.remove('show');
            
            // Use timeout to allow CSS transition to complete
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            
            console.log('UIThemeManager: Settings modal hidden successfully');
        } else {
            console.error('UIThemeManager: Settings modal element not found');
        }
    }

    showComposeModal(): void {
        console.log('UIThemeManager: Showing compose modal');
        const modal = document.getElementById('compose-modal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
            modal.style.zIndex = '10000';
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);
            console.log('UIThemeManager: Compose modal shown successfully');
        } else {
            console.error('UIThemeManager: Compose modal element not found');
        }
    }

    hideComposeModal(): void {
        console.log('UIThemeManager: Hiding compose modal');
        const modal = document.getElementById('compose-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            console.log('UIThemeManager: Compose modal hidden successfully');
        } else {
            console.error('UIThemeManager: Compose modal element not found');
        }
    }

    toggleTheme(): void {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
    }

    getCurrentTheme(): Theme {
        return this.theme as Theme;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Show loading overlay
     */
    showLoadingOverlay(show: boolean = true): void {
        console.log(`UIThemeManager: ${show ? 'Showing' : 'Hiding'} loading overlay`);
        if (this.domElements.loadingOverlay) {
            if (show) {
                this.domElements.loadingOverlay.classList.add('show');
            } else {
                this.domElements.loadingOverlay.classList.remove('show');
            }
        } else {
            console.warn('UIThemeManager: Loading overlay element not found');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay(): void {
        this.showLoadingOverlay(false);
    }
}

console.log('UIThemeManager module loaded successfully');

// Create and export a singleton instance
export const uiThemeManager = new UIThemeManager();

// Make it available globally for backward compatibility
if (typeof window !== 'undefined') {
    (window as any).uiThemeManager = uiThemeManager;
}

// Export the class as default
export default UIThemeManager;
