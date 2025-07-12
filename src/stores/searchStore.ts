// src/stores/searchStore.ts
import { create } from 'zustand';
import type { Email } from '../../types/email.js';

interface SearchState {
  query: string;
  results: Email[];
  loading: boolean;
  error: string | null;
  filters: {
    from: string;
    to: string;
    subject: string;
    hasAttachments: boolean;
    unreadOnly: boolean;
    dateRange: {
      start: Date | null;
      end: Date | null;
    };
  };
  setQuery: (query: string) => void;
  setResults: (results: Email[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<SearchState['filters']>) => void;
  clearSearch: () => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  filters: {
    from: '',
    to: '',
    subject: '',
    hasAttachments: false,
    unreadOnly: false,
    dateRange: {
      start: null,
      end: null,
    },
  },
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),
  clearSearch: () => set({ 
    query: '', 
    results: [], 
    error: null,
    filters: {
      from: '',
      to: '',
      subject: '',
      hasAttachments: false,
      unreadOnly: false,
      dateRange: {
        start: null,
        end: null,
      },
    }
  }),
  clearResults: () => set({ results: [] }),
})); 