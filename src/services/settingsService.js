import { api } from './api.js';

export const settingsService = {
  get: () => api.get('/settings'),
  /** Partial update — the API `$set`s only the keys sent. */
  update: (payload) => api.put('/settings', payload),
  updateFestival: (festival) => api.put('/settings', { festival }),
};
