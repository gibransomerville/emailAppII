/**
 * UI & Theme Management Module
 * Handles all UI state management, theme switching, modal controls, loading states, and notifications
 * 
 * Dependencies: SafeHTML (for secure HTML rendering)
 * 
 * @author Email App Modular Architecture
 * @version 1.0.0
 */

class UIThemeManager {
    constructor() {
        this.domElements = {};
        this.currentTheme = 'light';
        this.initialized = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    /**
     * Initialize the UI manager and cache DOM elements
     */
    initialize() {
        console.log('UIThemeManager: Initializing...');
        this.cacheDOMElements();
        this.loadTheme();
        this.initialized = true;
        console.log('UIThemeManager: Initialized successfully');
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheDOMElements() {
        this.domElements = {
            // Modals
            composeModal: document.getElementById('compose-modal'),
            settingsModal: document.getElementById('settings-modal'),
            oauthLoadingModal: document.getElementById('oauth-loading-modal'),
            
            // Loading overlay
            loadingOverlay: document.getElementById('loading-overlay'),
            
            // OAuth elements
            oauthProgressFill: document.getElementById('oauth-progress-fill'),
            oauthProgressText: document.getElementById('oauth-progress-text'),
            oauthProviderIcon: document.getElementById('oauth-provider-icon'),
            oauthLoadingTitle: document.getElementById('oauth-loading-title'),
            
            // Forms
            composeForm: document.getElementById('compose-form'),
            
            // Input fields
            toInput: document.getElementById('to-input'),
            ccInput: document.getElementById('cc-input'),
            subjectInput: document.getElementById('subject-input'),
            bodyInput: document.getElementById('body-input')
        };
        
        // Log which elements were found
        Object.entries(this.domElements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`UIThemeManager: Element '${key}' not found`);
            }
        });
    }

    /**
     * Switch application theme
     * @param {string} theme - Theme name ('light', 'dark', etc.)
     */
    switchTheme(theme) {
        if (!theme || typeof theme !== 'string') {
            console.warn('UIThemeManager: Invalid theme provided:', theme);
            return;
        }
        
        console.log(`UIThemeManager: Switching to ${theme} theme`);
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('email-app-theme', theme);
        this.currentTheme = theme;
        
        // Update active theme option
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === theme) {
                option.classList.add('active');
            }
        });
        
        this.showNotification(`Switched to ${theme} theme`, 'success');
    }

    /**
     * Load saved theme from localStorage
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('email-app-theme') || 'light';
        console.log(`UIThemeManager: Loading saved theme: ${savedTheme}`);
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.currentTheme = savedTheme;
        
        // Update active theme option
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === savedTheme) {
                option.classList.add('active');
            }
        });
    }

    /**
     * Get current theme
     * @returns {string} Current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    // ===== MODAL MANAGEMENT =====

    /**
     * Show compose modal
     */
    showComposeModal() {
        console.log('UIThemeManager: Showing compose modal');
        if (this.domElements.composeModal) {
            this.domElements.composeModal.classList.add('show');
            
            // Focus on the 'to' input field
            if (this.domElements.toInput) {
                setTimeout(() => this.domElements.toInput.focus(), 100);
            }
        } else {
            console.error('UIThemeManager: Compose modal element not found');
        }
    }

    /**
     * Hide compose modal and reset form
     */
    hideComposeModal() {
        console.log('UIThemeManager: Hiding compose modal');
        if (this.domElements.composeModal) {
            this.domElements.composeModal.classList.remove('show');
            
            // Reset the compose form
            if (this.domElements.composeForm) {
                this.domElements.composeForm.reset();
            }
        } else {
            console.error('UIThemeManager: Compose modal element not found');
        }
    }

    /**
     * Show settings modal
     */
    showSettingsModal() {
        console.log('UIThemeManager: Showing settings modal');
        if (this.domElements.settingsModal) {
            this.domElements.settingsModal.classList.add('show');
            console.log('UIThemeManager: Settings modal should now be visible');
        } else {
            console.error('UIThemeManager: Settings modal element not found');
        }
    }

    /**
     * Hide settings modal
     */
    hideSettingsModal() {
        console.log('UIThemeManager: Hiding settings modal');
        if (this.domElements.settingsModal) {
            this.domElements.settingsModal.classList.remove('show');
            console.log('UIThemeManager: Settings modal hidden');
        } else {
            console.error('UIThemeManager: Settings modal element not found');
        }
    }

    /**
     * Show OAuth loading modal
     * @param {string} provider - OAuth provider name ('google', 'microsoft', etc.)
     */
    showOAuthLoadingModal(provider = 'google') {
        console.log(`UIThemeManager: Showing OAuth loading modal for ${provider}`);
        
        if (this.domElements.oauthLoadingModal) {
            // Update provider-specific content
            if (this.domElements.oauthProviderIcon) {
                this.domElements.oauthProviderIcon.className = `fab fa-${provider}`;
            }
            
            if (this.domElements.oauthLoadingTitle) {
                const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                this.domElements.oauthLoadingTitle.textContent = `Connecting to ${providerName}`;
            }
            
            // Reset progress
            this.updateOAuthProgress(0, 'Initializing connection...');
            this.resetOAuthSteps();
            
            this.domElements.oauthLoadingModal.classList.add('show');
        } else {
            console.error('UIThemeManager: OAuth loading modal element not found');
        }
    }

    /**
     * Hide OAuth loading modal
     */
    hideOAuthLoadingModal() {
        console.log('UIThemeManager: Hiding OAuth loading modal');
        if (this.domElements.oauthLoadingModal) {
            this.domElements.oauthLoadingModal.classList.remove('show');
        } else {
            console.error('UIThemeManager: OAuth loading modal element not found');
        }
    }

    /**
     * Update OAuth progress
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} text - Progress text description
     */
    updateOAuthProgress(percentage, text) {
        if (this.domElements.oauthProgressFill) {
            this.domElements.oauthProgressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        }
        
        if (this.domElements.oauthProgressText && text) {
            this.domElements.oauthProgressText.textContent = text;
        }
    }

    /**
     * Update OAuth step status
     * @param {number} stepNumber - Step number (1-4)
     * @param {string} status - Step status ('active', 'completed', 'error')
     */
    updateOAuthStep(stepNumber, status = 'active') {
        const stepElement = document.getElementById(`step-${stepNumber}`);
        if (stepElement) {
            const icon = stepElement.querySelector('i');
            
            // Reset classes
            stepElement.classList.remove('active', 'completed', 'error');
            
            // Add new status
            stepElement.classList.add(status);
            
            // Update icon based on status
            if (icon) {
                icon.className = status === 'completed' ? 'fas fa-check-circle' : 
                                status === 'error' ? 'fas fa-times-circle' : 
                                status === 'active' ? 'fas fa-circle' : 'far fa-circle';
            }
        }
    }

    /**
     * Reset all OAuth steps to initial state
     */
    resetOAuthSteps() {
        for (let i = 1; i <= 4; i++) {
            const stepElement = document.getElementById(`step-${i}`);
            if (stepElement) {
                stepElement.classList.remove('active', 'completed', 'error');
                const icon = stepElement.querySelector('i');
                if (icon) {
                    icon.className = i === 1 ? 'fas fa-circle' : 'far fa-circle';
                }
            }
        }
        
        // Set first step as active
        this.updateOAuthStep(1, 'active');
    }

    // ===== LOADING STATES =====

    /**
     * Show or hide loading overlay
     * @param {boolean} show - Whether to show loading overlay
     */
    showLoading(show) {
        if (this.domElements.loadingOverlay) {
            if (show) {
                this.domElements.loadingOverlay.classList.add('show');
            } else {
                this.domElements.loadingOverlay.classList.remove('show');
            }
        } else {
            console.error('UIThemeManager: Loading overlay element not found');
        }
    }

    // ===== NOTIFICATIONS =====

    /**
     * Show notification toast
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
     */
    showNotification(message, type = 'info') {
        if (!message) {
            console.warn('UIThemeManager: No message provided for notification');
            return;
        }
        
        console.log(`UIThemeManager: Showing ${type} notification:`, message);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Use SafeHTML for secure content rendering
        const iconClass = this.getNotificationIcon(type);
        const safeMessage = typeof SafeHTML !== 'undefined' ? 
            SafeHTML.escapeHtml(message) : 
            this.escapeHtml(message);
        
        const notificationHTML = `
            <div class="notification-content">
                <i class="fas fa-${iconClass}"></i>
                <span>${safeMessage}</span>
            </div>
        `;
        
        if (typeof SafeHTML !== 'undefined') {
            SafeHTML.setInnerHTML(notification, notificationHTML, 'ui');
        } else {
            notification.innerHTML = notificationHTML;
        }
        
        // Apply styles
        this.styleNotification(notification, type);
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            this.removeNotification(notification);
        }, 3000);
    }

    /**
     * Get appropriate icon for notification type
     * @param {string} type - Notification type
     * @returns {string} Font Awesome icon class
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || icons.info;
    }

    /**
     * Apply styles to notification element
     * @param {HTMLElement} notification - Notification element
     * @param {string} type - Notification type
     */
    styleNotification(notification, type) {
        const colors = {
            success: { bg: '#d4edda', color: '#155724' },
            error: { bg: '#f8d7da', color: '#721c24' },
            warning: { bg: '#fff3cd', color: '#856404' },
            info: { bg: '#d1ecf1', color: '#0c5460' }
        };
        
        const colorScheme = colors[type] || colors.info;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colorScheme.bg};
            color: ${colorScheme.color};
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 3000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
    }

    /**
     * Remove notification with animation
     * @param {HTMLElement} notification - Notification element to remove
     */
    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }

    // ===== UTILITY METHODS =====

    /**
     * Simple HTML escaping (fallback if SafeHTML not available)
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Check if UI manager is initialized
     * @returns {boolean} Initialization status
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Get cached DOM element
     * @param {string} elementKey - Key for the cached element
     * @returns {HTMLElement|null} DOM element or null if not found
     */
    getElement(elementKey) {
        return this.domElements[elementKey] || null;
    }

    /**
     * Refresh DOM element cache
     */
    refreshDOMCache() {
        console.log('UIThemeManager: Refreshing DOM element cache...');
        this.cacheDOMElements();
    }
}

// Create global instance
const uiThemeManager = new UIThemeManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIThemeManager;
}

// Make available globally
window.UIThemeManager = UIThemeManager;
window.uiThemeManager = uiThemeManager;

// Legacy function wrappers for backward compatibility
function switchTheme(theme) {
    return uiThemeManager.switchTheme(theme);
}

function loadTheme() {
    return uiThemeManager.loadTheme();
}

function showComposeModal() {
    return uiThemeManager.showComposeModal();
}

function hideComposeModal() {
    return uiThemeManager.hideComposeModal();
}

function showSettingsModal() {
    return uiThemeManager.showSettingsModal();
}

function hideSettingsModal() {
    return uiThemeManager.hideSettingsModal();
}

function showOAuthLoadingModal(provider = 'google') {
    return uiThemeManager.showOAuthLoadingModal(provider);
}

function hideOAuthLoadingModal() {
    return uiThemeManager.hideOAuthLoadingModal();
}

function updateOAuthProgress(percentage, text) {
    return uiThemeManager.updateOAuthProgress(percentage, text);
}

function updateOAuthStep(stepNumber, status = 'active') {
    return uiThemeManager.updateOAuthStep(stepNumber, status);
}

function resetOAuthSteps() {
    return uiThemeManager.resetOAuthSteps();
}

function showLoading(show) {
    return uiThemeManager.showLoading(show);
}

function showNotification(message, type = 'info') {
    return uiThemeManager.showNotification(message, type);
}

console.log('UIThemeManager module loaded successfully'); 