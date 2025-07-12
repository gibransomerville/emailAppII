// src/stores/authStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './authStore.js';

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      lastLoginTime: null,
    });
  });

  describe('login', () => {
    it('should login with valid token', async () => {
      const store = useAuthStore.getState();
      const mockToken = global.testUtils.createMockToken();
      
      await store.login(mockToken);
      
      expect(store.isAuthenticated).toBe(true);
      expect(store.token).toEqual(mockToken);
      expect(store.error).toBeNull();
      expect(store.lastLoginTime).toBeGreaterThan(0);
    });

    it('should handle invalid token', async () => {
      const store = useAuthStore.getState();
      const invalidToken = { access_token: '', token_type: 'Bearer', scope: 'test-scope' };
      
      await store.login(invalidToken);
      
      expect(store.isAuthenticated).toBe(false);
      expect(store.token).toBeNull();
      expect(store.error).toBe('Invalid or expired token provided');
    });

    it('should handle expired token', async () => {
      const store = useAuthStore.getState();
      const expiredToken = global.testUtils.createMockToken({
        expiry_date: Date.now() - 1000, // Expired 1 second ago
      });
      
      await store.login(expiredToken);
      
      expect(store.isAuthenticated).toBe(false);
      expect(store.token).toBeNull();
      expect(store.error).toBe('Invalid or expired token provided');
    });

    it('should set loading state during login', async () => {
      const store = useAuthStore.getState();
      const mockToken = global.testUtils.createMockToken();
      
      // Start login
      const loginPromise = store.login(mockToken);
      
      // Check loading state
      expect(useAuthStore.getState().loading).toBe(true);
      
      // Wait for login to complete
      await loginPromise;
      
      // Check loading state is false
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear all auth state', () => {
      const store = useAuthStore.getState();
      
      // Set some state first
      store.login(global.testUtils.createMockToken());
      
      // Then logout
      store.logout();
      
      expect(store.token).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(store.error).toBeNull();
      expect(store.lastLoginTime).toBeNull();
    });
  });

  describe('updateToken', () => {
    it('should update token with valid token', async () => {
      const store = useAuthStore.getState();
      const initialToken = global.testUtils.createMockToken();
      const newToken = global.testUtils.createMockToken({ access_token: 'new-token' });
      
      // Login first
      await store.login(initialToken);
      
      // Update token
      await store.updateToken(newToken);
      
      expect(store.token).toEqual(newToken);
      expect(store.error).toBeNull();
    });

    it('should handle invalid token update', async () => {
      const store = useAuthStore.getState();
      const initialToken = global.testUtils.createMockToken();
      const invalidToken = { access_token: '', token_type: 'Bearer', scope: 'test-scope' };
      
      // Login first
      await store.login(initialToken);
      
      // Try to update with invalid token
      await store.updateToken(invalidToken);
      
      expect(store.token).toEqual(initialToken); // Should remain unchanged
      expect(store.error).toBe('Invalid token provided for update');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', () => {
      const store = useAuthStore.getState();
      const mockToken = global.testUtils.createMockToken();
      
      store.login(mockToken);
      
      expect(store.validateToken()).toBe(true);
    });

    it('should return false for null token', () => {
      const store = useAuthStore.getState();
      
      expect(store.validateToken()).toBe(false);
    });

    it('should return false for expired token', () => {
      const store = useAuthStore.getState();
      const expiredToken = global.testUtils.createMockToken({
        expiry_date: Date.now() - 1000,
      });
      
      store.login(expiredToken);
      
      expect(store.validateToken()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should clear error', () => {
      const store = useAuthStore.getState();
      
      store.setError('Test error');
      expect(store.error).toBe('Test error');
      
      store.clearError();
      expect(store.error).toBeNull();
    });

    it('should set loading state', () => {
      const store = useAuthStore.getState();
      
      store.setLoading(true);
      expect(store.loading).toBe(true);
      
      store.setLoading(false);
      expect(store.loading).toBe(false);
    });
  });
}); 