// src/stores/emailStore.ts
import { create } from 'zustand';
import type { Email, EmailConversation } from '../../types/email.js';

interface EmailState {
  emails: Email[];
  conversations: Record<string, EmailConversation>;
  selectedConversation: string | null;
  loading: boolean;
  error: string | null;
  setEmails: (emails: Email[]) => void;
  setConversations: (conversations: Record<string, EmailConversation>) => void;
  selectConversation: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addEmail: (email: Email) => void;
  updateEmail: (id: string, updates: Partial<Email>) => void;
  removeEmail: (id: string) => void;
  clearEmails: () => void;
}

export const useEmailStore = create<EmailState>((set, get) => ({
  emails: [],
  conversations: {},
  selectedConversation: null,
  loading: false,
  error: null,
  setEmails: (emails) => set({ emails }),
  setConversations: (conversations) => set({ conversations }),
  selectConversation: (id) => set({ selectedConversation: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  addEmail: (email) => set((state) => ({ emails: [...state.emails, email] })),
  updateEmail: (id, updates) => set((state) => ({
    emails: state.emails.map(email => 
      email.id === id ? { ...email, ...updates } : email
    )
  })),
  removeEmail: (id) => set((state) => ({
    emails: state.emails.filter(email => email.id !== id)
  })),
  clearEmails: () => set({ emails: [], conversations: {} }),
})); 