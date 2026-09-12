import { api } from './api.js';

export const bannerService = {
  list: () => api.get('/banners'),
  create: (payload) => api.post('/banners', payload),
  update: (id, payload) => api.put(`/banners/${id}`, payload),
  reorder: (id, direction) => api.patch(`/banners/${id}/reorder`, { direction }),
  remove: (id) => api.del(`/banners/${id}`),
};
