import { api } from './api.js';

/** Only the fields the banner API accepts — never _id, __v or timestamps. */
export const toBannerPayload = (b) => ({
  kicker: b.kicker || '',
  headline: (b.headline || '').trim(),
  sub: b.sub || '',
  cta: b.cta || '',
  ctaHref: (b.ctaHref || '').trim(),
  badge: [b.badge?.[0] || '', b.badge?.[1] || ''],
  status: b.status || 'Draft',
  order: Number(b.order) || 0,
  img: b.img,
});

export const bannerService = {
  list: () => api.get('/banners'),
  create: (payload) => api.post('/banners', payload),
  update: (id, payload) => api.put(`/banners/${id}`, payload),
  reorder: (id, direction) => api.patch(`/banners/${id}/reorder`, { direction }),
  remove: (id) => api.del(`/banners/${id}`),
};
