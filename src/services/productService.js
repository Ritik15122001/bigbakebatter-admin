import { api } from './api.js';

/** Fields the API accepts on create/update — used to build a clean copy for "Duplicate". */
const WRITABLE = ['name', 'cat', 'flavour', 'base', 'weights', 'tag', 'stock', 'qty', 'rating', 'reviews', 'eggless', 'veg', 'corporate', 'desc', 'img', 'ph'];

export const productService = {
  list: () => api.get('/products'),
  get: (id) => api.get(`/products/${id}`),
  create: (payload) => api.post('/products', payload),
  update: (id, payload) => api.put(`/products/${id}`, payload),
  adjustStock: (id, delta) => api.patch(`/products/${id}/stock`, { delta }),
  remove: (id) => api.del(`/products/${id}`),
  /** Creates "Copy of <name>" with the same details (sales count starts at 0). */
  duplicate: (product) => {
    const copy = Object.fromEntries(WRITABLE.filter((k) => product[k] !== undefined).map((k) => [k, product[k]]));
    return api.post('/products', { ...copy, name: `Copy of ${product.name}`, sold: 0 });
  },
};
