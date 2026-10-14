import { api } from './api.js';

/** Admin-only management endpoints: team accounts, newsletter subscribers, blog comment moderation. */
export const adminService = {
  // Team
  listAdmins: () => api.get('/admin/admins'),
  createAdmin: ({ name, email, password }) => api.post('/admin/admins', { name, email, password }),
  removeAdmin: (id) => api.del(`/admin/admins/${id}`),

  // Newsletter
  listSubscribers: () => api.get('/admin/subscribers'),
  removeSubscriber: (id) => api.del(`/admin/subscribers/${id}`),

  // Blog comments
  listComments: () => api.get('/admin/comments'),
  setCommentHidden: (id, hidden) => api.patch(`/admin/comments/${id}`, { hidden: !!hidden }),
  removeComment: (id) => api.del(`/admin/comments/${id}`),
};
