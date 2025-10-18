import { create } from 'zustand';
import { User, Document } from '@/types';
import api from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (token: string) => {
    try {
      set({ isLoading: true, error: null });
      localStorage.setItem('token', token);
      
      const { user } = await api.getCurrentUser();
      set({ 
        user, 
        token, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      localStorage.removeItem('token');
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ 
      user: null, 
      token: null, 
      isAuthenticated: false 
    });
  },

  fetchCurrentUser: async () => {
    try {
      set({ isLoading: true });
      const { user } = await api.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false, isAuthenticated: false });
      localStorage.removeItem('token');
    }
  }
}));

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  fetchDocuments: () => Promise<void>;
  fetchDocument: (id: number, token?: string) => Promise<void>;
  createDocument: (data: { title?: string; type?: string }) => Promise<Document>;
  updateDocument: (id: number, data: { title?: string; content?: string; save_version?: boolean }) => Promise<void>;
  deleteDocument: (id: number) => Promise<void>;
  setCurrentDocument: (document: Document | null) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  error: null,

  fetchDocuments: async () => {
    try {
      set({ isLoading: true, error: null });
      const { documents } = await api.getDocuments();
      set({ documents, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchDocument: async (id: number, token?: string) => {
    try {
      set({ isLoading: true, error: null });
      const { document, role } = await api.getDocument(id, token);
      document.role = role;
      set({ currentDocument: document, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createDocument: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const { document } = await api.createDocument(data);
      set({ 
        documents: [document, ...get().documents],
        currentDocument: document,
        isLoading: false 
      });
      return document;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateDocument: async (id, data) => {
    try {
      const { document } = await api.updateDocument(id, data);
      set({ 
        documents: get().documents.map(d => d.id === id ? document : d),
        currentDocument: get().currentDocument?.id === id ? document : get().currentDocument
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteDocument: async (id) => {
    try {
      await api.deleteDocument(id);
      set({ 
        documents: get().documents.filter(d => d.id !== id),
        currentDocument: get().currentDocument?.id === id ? null : get().currentDocument
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  setCurrentDocument: (document) => {
    set({ currentDocument: document });
  }
}));
