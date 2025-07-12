// src/stores/authStore.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { platformStorage } from './middleware/storage.js';
import type { GoogleOAuthCredentials } from '../auth/auth-manager.js';

interface AuthState {
  token: GoogleOAuthCredentials | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  lastLoginTime: number | null;
  login: (token: GoogleOAuthCredentials) => Promise<void>;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateToken: (token: GoogleOAuthCredentials) => Promise<void>;
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

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

export const useAuthStore = create<AuthState>()(
  devtools(
    immer(
      persist(
        (set, get) => ({
          token: null,
          isAuthenticated: false,
          loading: false,
          error: null,
          lastLoginTime: null,
          
          login: async (token: GoogleOAuthCredentials) => {
            set((state) => {
              state.loading = true;
              state.error = null;
            });
            
            try {
              if (!validateToken(token)) {
                throw new Error('Invalid or expired token provided');
              }
              
              set((state) => {
                state.token = token;
                state.isAuthenticated = true;
                state.error = null;
                state.lastLoginTime = Date.now();
              });
            } catch (error) {
              set((state) => {
                state.error = error instanceof Error ? error.message : 'Login failed';
              });
            } finally {
              set((state) => {
                state.loading = false;
              });
            }
          },
          
          logout: () => set((state) => {
            state.token = null;
            state.isAuthenticated = false;
            state.error = null;
            state.lastLoginTime = null;
          }),
          
          setLoading: (loading: boolean) => set((state) => {
            state.loading = loading;
          }),
          
          setError: (error: string | null) => set((state) => {
            state.error = error;
          }),
          
          updateToken: async (token: GoogleOAuthCredentials) => {
            set((state) => {
              state.loading = true;
              state.error = null;
            });
            
            try {
              if (!validateToken(token)) {
                throw new Error('Invalid token provided for update');
              }
              
              set((state) => {
                state.token = token;
              });
            } catch (error) {
              set((state) => {
                state.error = error instanceof Error ? error.message : 'Token update failed';
              });
            } finally {
              set((state) => {
                state.loading = false;
              });
            }
          },
          
          clearError: () => set((state) => {
            state.error = null;
          }),
          
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
    ),
    { 
      name: 'AuthStore', 
      enabled: isDevelopment 
    }
  )
); 