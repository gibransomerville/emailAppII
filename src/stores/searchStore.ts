// src/stores/searchStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Email } from '../../types/email.js';

export interface SearchFilters {
  from: string;
  to: string;
  subject: string;
  hasAttachments: boolean;
  isRead: boolean | null;
  dateFrom: string;
  dateTo: string;
}

interface SearchState {
  query: string;
  results: Email[];
  loading: boolean;
  error: string | null;
  filters: SearchFilters;
  search: (query: string, filters?: Partial<SearchFilters>) => Promise<void>;
  setQuery: (query: string) => void;
  setResults: (results: Email[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateFilters: (filters: Partial<SearchFilters>) => void;
  clearSearch: () => void;
  validateQuery: (query: string) => { isValid: boolean; errors: string[] };
}

const defaultFilters: SearchFilters = {
  from: '',
  to: '',
  subject: '',
  hasAttachments: false,
  isRead: null,
  dateFrom: '',
  dateTo: '',
};

// Search validation
const validateQuery = (query: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (query.trim().length < 2) {
    errors.push('Search query must be at least 2 characters long');
  }
  
  if (query.length > 500) {
    errors.push('Search query cannot exceed 500 characters');
  }
  
  // Check for potentially problematic characters
  const problematicChars = /[<>{}]/;
  if (problematicChars.test(query)) {
    errors.push('Search query contains invalid characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

export const useSearchStore = create<SearchState>()(
  devtools(
    immer(
      (set, get) => ({
        query: '',
        results: [],
        loading: false,
        error: null,
        filters: defaultFilters,
        
        search: async (query: string, filters?: Partial<SearchFilters>) => {
          set((state) => {
            state.loading = true;
            state.error = null;
          });
          
          try {
            // Validate query
            const validation = validateQuery(query);
            if (!validation.isValid) {
              throw new Error(`Search validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Update query and filters
            set((state) => {
              state.query = query;
              if (filters) {
                Object.assign(state.filters, filters);
              }
            });
            
            // Simulate search (replace with actual search logic)
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Mock results for testing
            const mockResults: Email[] = [];
            set((state) => {
              state.results = mockResults;
            });
            
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Search failed';
            });
          } finally {
            set((state) => {
              state.loading = false;
            });
          }
        },
        
        setQuery: (query: string) => set((state) => {
          state.query = query;
        }),
        
        setResults: (results: Email[]) => set((state) => {
          state.results = results;
        }),
        
        setLoading: (loading: boolean) => set((state) => {
          state.loading = loading;
        }),
        
        setError: (error: string | null) => set((state) => {
          state.error = error;
        }),
        
        updateFilters: (filters: Partial<SearchFilters>) => set((state) => {
          Object.assign(state.filters, filters);
        }),
        
        clearSearch: () => set((state) => {
          state.query = '';
          state.results = [];
          state.error = null;
          state.filters = { ...defaultFilters };
        }),
        
        validateQuery: (query: string) => validateQuery(query),
      })
    ),
    { 
      name: 'SearchStore', 
      enabled: isDevelopment 
    }
  )
); 