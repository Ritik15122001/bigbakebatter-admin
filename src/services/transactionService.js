import { api } from './api.js';

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const v = typeof value === 'string' ? value.trim() : value;
    if (v && v !== 'All') search.set(key, v);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const transactionService = {
  list: (params = {}) => api.get(`/transactions${query(params)}`),
  summary: () => api.get('/transactions/summary'),
  /** Records a refund (the money itself is refunded in Razorpay) and cancels the linked order. */
  refund: (id) => api.patch(`/transactions/${id}/refund`, {}),
};
