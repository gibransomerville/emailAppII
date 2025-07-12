// src/stores/emailStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Email, EmailConversation } from '../../types/email.js';

interface EmailState {
  emails: Email[];
  conversations: Record<string, EmailConversation>;
  selectedConversation: string | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  setEmails: (emails: Email[]) => void;
  setConversations: (conversations: Record<string, EmailConversation>) => void;
  selectConversation: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addEmail: (email: Email) => void;
  updateEmail: (id: string, updates: Partial<Email>) => void;
  removeEmail: (id: string) => void;
  clearEmails: () => void;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  getUnreadCount: () => number;
  getEmailById: (id: string) => Email | undefined;
}

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

export const useEmailStore = create<EmailState>()(
  devtools(
    immer(
      (set, get) => ({
        emails: [],
        conversations: {},
        selectedConversation: null,
        loading: false,
        error: null,
        lastUpdated: null,
        
        setEmails: (emails) => set((state) => {
          state.emails = emails;
          state.lastUpdated = Date.now();
        }),
        
        setConversations: (conversations) => set((state) => {
          state.conversations = conversations;
        }),
        
        selectConversation: (id) => set((state) => {
          state.selectedConversation = id;
        }),
        
        setLoading: (loading) => set((state) => {
          state.loading = loading;
        }),
        
        setError: (error) => set((state) => {
          state.error = error;
        }),
        
        addEmail: (email) => set((state) => {
          state.emails.push(email);
          state.lastUpdated = Date.now();
        }),
        
        updateEmail: (id, updates) => set((state) => {
          const emailIndex = state.emails.findIndex(email => email.id === id);
          if (emailIndex !== -1) {
            Object.assign(state.emails[emailIndex], updates);
            state.lastUpdated = Date.now();
          }
        }),
        
        removeEmail: (id) => set((state) => {
          state.emails = state.emails.filter(email => email.id !== id);
          state.lastUpdated = Date.now();
        }),
        
        clearEmails: () => set((state) => {
          state.emails = [];
          state.conversations = {};
          state.selectedConversation = null;
          state.lastUpdated = Date.now();
        }),
        
        markAsRead: (id) => set((state) => {
          const email = state.emails.find(e => e.id === id);
          if (email) {
            email.read = true;
            state.lastUpdated = Date.now();
          }
        }),
        
        markAsUnread: (id) => set((state) => {
          const email = state.emails.find(e => e.id === id);
          if (email) {
            email.read = false;
            state.lastUpdated = Date.now();
          }
        }),
        
        getUnreadCount: () => {
          const state = get();
          return state.emails.filter(email => !email.read).length;
        },
        
        getEmailById: (id) => {
          const state = get();
          return state.emails.find(email => email.id === id);
        },
      })
    ),
    { 
      name: 'EmailStore', 
      enabled: isDevelopment 
    }
  )
); 