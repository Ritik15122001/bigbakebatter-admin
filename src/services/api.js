export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

/** Registered once from the auth store so 401s anywhere can force a sign-out. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/**
 * Turns the backend's zod `details` ({ field: [msgs] }) into one readable line,
 * e.g. "name: Required · price: Expected number". Every page shows `err.message`
 * in its toast, so doing this here means every form benefits.
 */
function describeDetails(details) {
  if (!details || typeof details !== 'object') return '';
  const parts = Object.entries(details)
    .map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.filter(Boolean).join(', ') : String(msgs ?? '');
      return text ? `${field}: ${text}` : '';
    })
    .filter(Boolean);
  return parts.join(' · ');
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  let res;
  try {
    res = await fetch(BASE_URL + path, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    const error = new Error('Could not reach the server. Check your connection and try again.');
    error.status = 0;
    throw error;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (res.status === 401 && onUnauthorized) onUnauthorized();

  if (!res.ok) {
    const base = body?.message || `Request failed (${res.status})`;
    const detail = describeDetails(body?.details);
    const error = new Error(detail ? (base === 'Validation failed' ? detail : `${base} — ${detail}`) : base);
    error.status = res.status;
    error.details = body?.details;
    throw error;
  }

  return body;
}

export const api = {
  get: (path) => apiRequest(path).then((r) => r.data),
  post: (path, data) => apiRequest(path, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }).then((r) => r.data),
  put: (path, data) => apiRequest(path, { method: 'PUT', body: JSON.stringify(data) }).then((r) => r.data),
  patch: (path, data) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.data),
  del: (path) => apiRequest(path, { method: 'DELETE' }).then((r) => r.data),
};
