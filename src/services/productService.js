import { api } from './api.js';

export const productService = {
  list: () => api.get('/products'),
  create: (payload) => api.post('/products', payload),
  update: (id, payload) => api.put(`/products/${id}`, payload),
  adjustStock: (id, delta) => api.patch(`/products/${id}/stock`, { delta }),
  remove: (id) => api.del(`/products/${id}`),
};
