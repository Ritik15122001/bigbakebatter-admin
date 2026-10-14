import { api } from './api.js';

export const ORDER_STATUSES = ['New', 'Baking', 'Out for delivery', 'Delivered', 'Cancelled'];

export const orderService = {
  list: (status) => api.get(status && status !== 'All' ? `/orders?status=${encodeURIComponent(status)}` : '/orders'),
  /** → { order, transaction } */
  get: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  /** Delivery details / internal note: any of { customer, phone, addr, deliver, slot, msg, adminNote }. */
  update: (id, payload) => api.patch(`/orders/${id}`, payload),
};
