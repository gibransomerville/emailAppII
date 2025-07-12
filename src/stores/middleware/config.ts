// src/stores/middleware/config.ts
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

// DevTools configuration
export const devtoolsConfig = {
  name: 'EmailApp',
  enabled: isDevelopment,
  anonymousActionType: 'Unknown',
  serialize: {
    options: {
      undefined: true,
      function: (fn: Function) => fn.toString(),
    },
  },
};

// Create devtools middleware with configuration
export const createDevtools = (storeName: string) => 
  devtools(
    (set, get, api) => ({
      set: (partial: any, replace?: boolean) => {
        set(partial, replace);
        if (isDevelopment) {
          console.log(`${storeName} state updated:`, get());
        }
      },
      get,
      api,
    }),
    { 
      name: storeName,
      enabled: isDevelopment 
    }
  );

// Create immer middleware wrapper
export const createImmer = (config: any) => immer(config);

// Combined middleware factory
export const createStoreMiddleware = (storeName: string) => {
  const middlewares = [];
  
  // Add immer for immutable updates
  middlewares.push(createImmer);
  
  // Add devtools in development
  if (isDevelopment) {
    middlewares.push(createDevtools(storeName));
  }
  
  return middlewares;
};

// Logging middleware for debugging
export const createLoggingMiddleware = (storeName: string) => 
  (config: any) => 
    (set: any, get: any, api: any) => {
      const originalSet = set;
      
      const setWithLogging = (partial: any, replace?: boolean) => {
        if (isDevelopment) {
          const prevState = get();
          console.group(`${storeName} State Change`);
          console.log('Previous State:', prevState);
          console.log('Update:', partial);
        }
        
        originalSet(partial, replace);
        
        if (isDevelopment) {
          const nextState = get();
          console.log('Next State:', nextState);
          console.groupEnd();
        }
      };
      
      return config(setWithLogging, get, api);
    };

// Performance monitoring middleware
export const createPerformanceMiddleware = (storeName: string) =>
  (config: any) =>
    (set: any, get: any, api: any) => {
      const originalSet = set;
      
      const setWithPerformance = (partial: any, replace?: boolean) => {
        const startTime = performance.now();
        
        originalSet(partial, replace);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (isDevelopment && duration > 16) { // Log if update takes more than 16ms
          console.warn(`${storeName} state update took ${duration.toFixed(2)}ms`);
        }
      };
      
      return config(setWithPerformance, get, api);
    }; 