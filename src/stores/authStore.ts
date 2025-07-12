// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GoogleOAuthCredentials } from '../auth/auth-manager.js';

interface AuthState {
  token: GoogleOAuthCredentials | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (token: GoogleOAuthCredentials) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateToken: (token: GoogleOAuthCredentials) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      login: (token) => set({ token, isAuthenticated: true, error: null }),
      logout: () => set({ token: null, isAuthenticated: false, error: null }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      updateToken: (token) => set({ token }),
    }),
    {
      name: 'auth-storage', // Key for localStorage
      partialize: (state) => ({ token: state.token }), // Persist only token
    }
  )
); 