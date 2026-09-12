import { api } from './api.js';

export const blogService = {
  list: () => api.get('/blog'),
  create: (payload) => api.post('/blog', payload),
  update: (id, payload) => api.put(`/blog/${id}`, payload),
  remove: (id) => api.del(`/blog/${id}`),
};
