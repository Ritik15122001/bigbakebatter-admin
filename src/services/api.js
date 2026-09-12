const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

/** Registered once from the auth store so 401s anywhere can force a sign-out. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (res.status === 401 && onUnauthorized) onUnauthorized();

  if (!res.ok) {
    const message = body?.message || `Request failed (${res.status})`;
    const error = new Error(message);
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
