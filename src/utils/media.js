import { BASE_URL } from '../services/api.js';

/** API origin without the trailing `/api`, e.g. "https://api.example.com". */
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

/**
 * Display URL for an image stored in the DB. Uploaded files are stored as
 * relative "/uploads/..." paths and live on the API host; absolute http(s)
 * URLs (and anything else) are used as-is.
 */
export function resolveImg(src) {
  if (!src || typeof src !== 'string') return '';
  if (src.startsWith('/uploads/')) return API_ORIGIN + src;
  return src;
}
