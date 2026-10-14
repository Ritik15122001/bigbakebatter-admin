import { api } from './api.js';

export const ENQUIRY_STATUSES = ['New', 'Quoted', 'Closed'];

export const enquiryService = {
  list: () => api.get('/enquiries'),
  updateStatus: (id, status) => api.patch(`/enquiries/${id}/status`, { status }),
  /** Any of { status, adminNote, quote (number | null) }. */
  update: (id, payload) => api.patch(`/enquiries/${id}`, payload),
  remove: (id) => api.del(`/enquiries/${id}`),
};
