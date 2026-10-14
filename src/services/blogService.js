import { api } from './api.js';

/** Fields the blog API accepts (see backend validators/blogValidators.js) — never _id, views or timestamps. */
const BLOG_FIELDS = ['title', 'cat', 'excerpt', 'body', 'img', 'status', 'read'];
export const toBlogPayload = (p) => Object.fromEntries(BLOG_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));

export const blogService = {
  list: () => api.get('/blog'),
  /** Loads one post from the admin list — GET /blog/:id would count as a page view. */
  get: async (id) => {
    const post = (await api.get('/blog')).find((p) => p._id === id);
    if (!post) {
      const err = new Error('This post no longer exists');
      err.status = 404;
      throw err;
    }
    return post;
  },
  create: (payload) => api.post('/blog', toBlogPayload(payload)),
  update: (id, payload) => api.put(`/blog/${id}`, toBlogPayload(payload)),
  remove: (id) => api.del(`/blog/${id}`),
  /** Visible comments on one post (public endpoint). */
  comments: (id) => api.get(`/blog/${id}/comments`),
};
