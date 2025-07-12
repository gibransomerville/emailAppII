// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { platformStorage } from './middleware/storage.js';
import type { GoogleOAuthCredentials } from '../auth/auth-manager.js';

interface AuthState {
  token: GoogleOAuthCredentials | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  lastLoginTime: number | null;
  login: (token: GoogleOAuthCredentials) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateToken: (token: GoogleOAuthCredentials) => void;
  clearError: () => void;
  validateToken: () => boolean;
}

// Token validation utility
const validateToken = (token: GoogleOAuthCredentials | null): boolean => {
  if (!token) return false;
  
  // Check for required fields
  if (!token.access_token || !token.token_type) {
    return false;
  }
  
  // Check if token is expired
  if (token.expiry_date && Date.now() >= token.expiry_date) {
    return false;
  }
  
  return true;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      lastLoginTime: null,
      
      login: (token: GoogleOAuthCredentials) => {
        if (!validateToken(token)) {
          set({ error: 'Invalid or expired token provided' });
          return;
        }
        
        set({ 
          token, 
          isAuthenticated: true, 
          error: null, 
          lastLoginTime: Date.now() 
        });
      },
      
      logout: () => set({ 
        token: null, 
        isAuthenticated: false, 
        error: null, 
        lastLoginTime: null 
      }),
      
      setLoading: (loading: boolean) => set({ loading }),
      
      setError: (error: string | null) => set({ error }),
      
      updateToken: (token: GoogleOAuthCredentials) => {
        if (!validateToken(token)) {
          set({ error: 'Invalid token provided for update' });
          return;
        }
        set({ token });
      },
      
      clearError: () => set({ error: null }),
      
      validateToken: () => {
        const { token } = get();
        return validateToken(token);
      },
    }),
    {
      name: 'auth-storage',
      storage: platformStorage,
      partialize: (state) => ({ 
        token: state.token,
        lastLoginTime: state.lastLoginTime 
      }),
      onRehydrateStorage: () => (state) => {
        if (state && !validateToken(state.token)) {
          console.warn('Stored token is invalid, clearing auth state');
          state.token = null;
          state.isAuthenticated = false;
          state.lastLoginTime = null;
        }
      },
    }
  )
); 