import { create } from 'zustand';
import { api, BASE_URL, setAuthToken, setUnauthorizedHandler } from '../services/api.js';

const STORAGE_KEY = 'bbb_admin_token';

const readToken = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked (private mode) — the session still works until reload
  }
};

const savedToken = readToken();
if (savedToken) setAuthToken(savedToken);

export const useAuthStore = create((set, get) => ({
  token: savedToken || null,
  user: null,
  status: savedToken ? 'checking' : 'signedOut', // 'checking' | 'signedIn' | 'signedOut'

  /** Stores a (new) session token everywhere it is needed. */
  setToken: (token) => {
    writeToken(token);
    setAuthToken(token);
    set({ token });
  },

  login: async (email, password) => {
    const data = await api.post('/auth/login', { email: email.trim(), password });
    if (data.user.role !== 'admin') {
      throw new Error('This account does not have admin access');
    }
    get().setToken(data.token);
    set({ user: data.user, status: 'signedIn' });
  },

  logout: () => {
    writeToken(null);
    setAuthToken(null);
    set({ token: null, user: null, status: 'signedOut' });
  },

  hydrate: async () => {
    const token = get().token || readToken();
    if (!token) {
      set({ status: 'signedOut' });
      return;
    }
    setAuthToken(token);
    try {
      const user = await api.get('/auth/me');
      if (user.role !== 'admin') throw new Error('Not an admin account');
      set({ user, token, status: 'signedIn' });
    } catch {
      get().logout();
    }
  },

  /** Re-reads the signed-in admin (e.g. after editing the profile). */
  refreshUser: async () => {
    const user = await api.get('/auth/me');
    set({ user });
    return user;
  },

  /**
   * Changes the signed-in admin's password. The API signs out every other session and returns a fresh token
   * for this one, which is stored so this tab stays signed in.
   * Uses fetch directly: a wrong current password answers 401, which must NOT trigger the global sign-out.
   */
  changePassword: async (currentPassword, newPassword) => {
    let res;
    try {
      res = await fetch(`${BASE_URL}/auth/me/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${get().token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = body?.details ? Object.values(body.details).flat().filter(Boolean).join(' · ') : '';
      const err = new Error(detail || body?.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.details = body?.details;
      throw err;
    }
    if (body?.data?.token) get().setToken(body.data.token);
    return body?.data;
  },
}));

setUnauthorizedHandler(() => useAuthStore.getState().logout());
