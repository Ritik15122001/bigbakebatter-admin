import { api } from './api.js';

export const notificationService = {
  /** → { items: [{ _id, type, title, message, link, read, createdAt }], unreadCount } */
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`, {}),
  markAllRead: () => api.patch('/notifications/read-all', {}),
};
