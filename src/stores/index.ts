// src/stores/index.ts
// Export all Zustand stores for easy importing

export { useAuthStore } from './authStore.js';
export { useEmailStore } from './emailStore.js';
export { useUIStore } from './uiStore.js';
export { useSearchStore } from './searchStore.js';
export { useSettingsStore } from './settingsStore.js';

// Export selectors
export * from './selectors.js';

// Export middleware utilities
export * from './middleware/storage.js';
export * from './middleware/config.js';

// Export types
export type { EmailSettings, UISettings, SecuritySettings } from './settingsStore.js'; 