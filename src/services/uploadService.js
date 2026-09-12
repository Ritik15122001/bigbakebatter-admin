import { api, apiRequest } from './api.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';
export const fileUrl = (path) => (path?.startsWith('http') ? path : `${BASE_URL.replace(/\/api$/, '')}${path}`);

export const uploadService = {
  upload: async (file) => {
    const form = new FormData();
    form.append('image', file);
    const data = await api.post('/uploads', form);
    return fileUrl(data.url);
  },
};

// re-export for consumers that want the raw request (not currently needed, kept for parity with main app's api.js shape)
export { apiRequest };
