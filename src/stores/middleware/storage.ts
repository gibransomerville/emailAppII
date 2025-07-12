// src/stores/middleware/storage.ts
import { createJSONStorage } from 'zustand/middleware';

// Platform detection (will be enhanced for React Native)
const isWeb = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// Web storage implementation
const webStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.warn('Failed to get item from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn('Failed to set item in localStorage:', error);
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn('Failed to remove item from localStorage:', error);
    }
  },
};

// Future React Native storage implementation
// const rnStorage = {
//   getItem: async (name: string): Promise<string | null> => {
//     try {
//       const AsyncStorage = await import('@react-native-async-storage/async-storage');
//       return await AsyncStorage.default.getItem(name);
//     } catch (error) {
//       console.warn('Failed to get item from AsyncStorage:', error);
//       return null;
//     }
//   },
//   setItem: async (name: string, value: string): Promise<void> => {
//     try {
//       const AsyncStorage = await import('@react-native-async-storage/async-storage');
//       await AsyncStorage.default.setItem(name, value);
//     } catch (error) {
//       console.warn('Failed to set item in AsyncStorage:', error);
//     }
//   },
//   removeItem: async (name: string): Promise<void> => {
//     try {
//       const AsyncStorage = await import('@react-native-async-storage/async-storage');
//       await AsyncStorage.default.removeItem(name);
//     } catch (error) {
//       console.warn('Failed to remove item from AsyncStorage:', error);
//     }
//   },
// };

// Platform-agnostic storage factory
export const createPlatformStorage = () => {
  if (isWeb) {
    return createJSONStorage(() => webStorage);
  }
  
  // For React Native (future implementation)
  // return createJSONStorage(() => rnStorage);
  
  // Fallback for other environments
  return createJSONStorage(() => ({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }));
};

// Export current storage for immediate use
export const platformStorage = createPlatformStorage();

// Storage utilities
export const storageUtils = {
  isAvailable: () => isWeb,
  clearAll: () => {
    if (isWeb) {
      try {
        localStorage.clear();
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
      }
    }
  },
  getSize: () => {
    if (isWeb) {
      try {
        return new Blob(Object.values(localStorage)).size;
      } catch (error) {
        console.warn('Failed to calculate storage size:', error);
        return 0;
      }
    }
    return 0;
  },
}; 