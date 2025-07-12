// src/test/setup.ts
import { beforeAll, afterEach, afterAll, vi } from 'vitest';

// Mock localStorage for tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock crypto for tests
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: vi.fn(),
  },
});

// Clean up after each test
afterEach(() => {
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});

// Global test utilities
declare global {
  var testUtils: {
    createMockEmail: (overrides?: any) => any;
    createMockToken: (overrides?: any) => any;
  };
}

global.testUtils = {
  createMockEmail: (overrides = {}) => ({
    id: 'test-email-1',
    subject: 'Test Email',
    from: 'test@example.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    read: false,
    attachments: [],
    ...overrides,
  }),
  
  createMockToken: (overrides = {}) => ({
    access_token: 'test-access-token',
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    expiry_date: Date.now() + 3600000, // 1 hour from now
    ...overrides,
  }),
}; 