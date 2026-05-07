const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data.token;
}

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && localStorage.getItem('refreshToken') && !options._isRetry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    try {
      const newToken = await (refreshPromise || refreshAccessToken());
      return request(endpoint, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
        _isRetry: true,
      });
    } catch {
      // Refresh failed, propagate the original error
    }
  }

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    if (data.organizations) err.organizations = data.organizations;
    throw err;
  }

  return data;
}
