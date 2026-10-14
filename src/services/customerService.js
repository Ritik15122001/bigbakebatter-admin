import { api } from './api.js';

export const customerService = {
  list: () => api.get('/customers'),
  /** → { customer, stats:{orders, spent, aov, lastOrderAt}, orders[], transactions[], enquiries[] } */
  get: (id) => api.get(`/customers/${id}`),
  setBlocked: (id, blocked) => api.patch(`/customers/${id}/block`, { blocked: !!blocked }),
};
