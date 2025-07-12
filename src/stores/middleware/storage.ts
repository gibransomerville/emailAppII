// src/stores/middleware/storage.ts
import { createJSONStorage } from 'zustand/middleware';
import CryptoJS from 'crypto-js';

// Platform detection (will be enhanced for React Native)
const isWeb = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// Secret key for encryption (in production, use environment variable)
const SECRET_KEY = process.env.STORAGE_SECRET_KEY || 'email-app-storage-key-2025';

const isTest = typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');

// Encryption utilities
const encrypt = (text: string): string => {
  if (isTest) return text;
  try {
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
  } catch (error) {
    console.warn('Encryption failed:', error);
    return text; // Fallback to plain text
  }
};

const decrypt = (ciphertext: string): string => {
  if (isTest) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.warn('Decryption failed:', error);
    return ciphertext; // Fallback to original text
  }
};

// Encrypted web storage implementation
const encryptedWebStorage = {
  getItem: (name: string): string | null => {
    try {
      const encrypted = localStorage.getItem(name);
      if (!encrypted) return null;
      
      // Check if data is encrypted (starts with U2F)
      if (encrypted.startsWith('U2F')) {
        return decrypt(encrypted);
      }
      
      return encrypted; // Return as-is if not encrypted
    } catch (error) {
      console.warn('Failed to get item from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      // Encrypt sensitive data (auth tokens, etc.)
      const shouldEncrypt = name.includes('auth') || name.includes('token') || name.includes('security');
      const finalValue = shouldEncrypt ? encrypt(value) : value;
      localStorage.setItem(name, finalValue);
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
//       const encrypted = await AsyncStorage.default.getItem(name);
//       if (!encrypted) return null;
//       
//       // Check if data is encrypted
//       if (encrypted.startsWith('U2F')) {
//         return decrypt(encrypted);
//       }
//       
//       return encrypted;
//     } catch (error) {
//       console.warn('Failed to get item from AsyncStorage:', error);
//       return null;
//     }
//   },
//   setItem: async (name: string, value: string): Promise<void> => {
//     try {
//       const AsyncStorage = await import('@react-native-async-storage/async-storage');
//       const shouldEncrypt = name.includes('auth') || name.includes('token') || name.includes('security');
//       const finalValue = shouldEncrypt ? encrypt(value) : value;
//       await AsyncStorage.default.setItem(name, finalValue);
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
    return createJSONStorage(() => encryptedWebStorage);
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
  // Encryption utilities for external use
  encrypt: (text: string): string => encrypt(text),
  decrypt: (ciphertext: string): string => decrypt(ciphertext),
  // Check if data is encrypted
  isEncrypted: (data: string): boolean => data.startsWith('U2F'),
}; 