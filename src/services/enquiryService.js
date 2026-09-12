import { api } from './api.js';

export const enquiryService = {
  list: () => api.get('/enquiries'),
  updateStatus: (id, status) => api.patch(`/enquiries/${id}/status`, { status }),
};
