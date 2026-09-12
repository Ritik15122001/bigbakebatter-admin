import { api } from './api.js';

export const orderService = {
  list: (status) => api.get(status && status !== 'All' ? `/orders?status=${encodeURIComponent(status)}` : '/orders'),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
};
