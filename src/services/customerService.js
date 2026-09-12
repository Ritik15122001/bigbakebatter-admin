import { api } from './api.js';

export const customerService = {
  list: () => api.get('/customers'),
};
