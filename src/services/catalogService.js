import { api } from './api.js';

function simpleResource(base) {
  return {
    list: () => api.get(base),
    create: (payload) => api.post(base, payload),
    update: (id, payload) => api.put(`${base}/${id}`, payload),
    remove: (id) => api.del(`${base}/${id}`),
  };
}

export const categoryService = simpleResource('/categories');
export const flavourService = simpleResource('/flavours');
export const occasionService = simpleResource('/occasions');
export const addonService = simpleResource('/addons');
export const faqService = simpleResource('/faqs');
export const reviewService = simpleResource('/reviews');
