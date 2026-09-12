import { create } from 'zustand';
import { api, setAuthToken, setUnauthorizedHandler } from '../services/api.js';

const STORAGE_KEY = 'bbb_admin_token';

const savedToken = localStorage.getItem(STORAGE_KEY);
if (savedToken) setAuthToken(savedToken);

export const useAuthStore = create((set) => ({
  token: savedToken || null,
  user: null,
  status: savedToken ? 'checking' : 'signedOut', // 'checking' | 'signedIn' | 'signedOut'

  login: async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    if (data.user.role !== 'admin') {
      throw new Error('This account does not have admin access');
    }
    localStorage.setItem(STORAGE_KEY, data.token);
    setAuthToken(data.token);
    set({ token: data.token, user: data.user, status: 'signedIn' });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    set({ token: null, user: null, status: 'signedOut' });
  },

  hydrate: async () => {
    if (!savedToken) return;
    try {
      const user = await api.get('/auth/me');
      if (user.role !== 'admin') throw new Error('Not an admin account');
      set({ user, status: 'signedIn' });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setAuthToken(null);
      set({ token: null, user: null, status: 'signedOut' });
    }
  },
}));

setUnauthorizedHandler(() => useAuthStore.getState().logout());
