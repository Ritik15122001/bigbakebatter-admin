import { api } from './api.js';

export const uploadService = {
  /**
   * Uploads one image and returns the RELATIVE path the API gives back
   * (e.g. "/uploads/abc.jpg"). That relative path is what gets stored in the
   * database; use `resolveImg()` from utils/media to display it.
   */
  upload: async (file) => {
    const form = new FormData();
    form.append('image', file);
    const data = await api.post('/uploads', form);
    return data.url;
  },
};
