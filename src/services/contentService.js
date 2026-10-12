import { api } from './api.js';

/** Editable storefront page text/sections (registry lives in the backend). */
export const contentService = {
  schema: () => api.get('/content/schema'),
  all: () => api.get('/content'),
  save: (key, data) => api.put(`/content/${encodeURIComponent(key)}`, { data }),
  reset: (key) => api.del(`/content/${encodeURIComponent(key)}`),
};
