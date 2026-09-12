import { api } from './api.js';

export const dashboardService = {
  getStats: () => api.get('/dashboard'),
};
