import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Reads from app.json extra.apiUrl, falls back to localhost for simulator
const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.3:3001/api';

async function getToken() {
  return await SecureStore.getItemAsync('token');
}

let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    throw new Error('Session expired');
  }

  const data = await res.json();
  await SecureStore.setItemAsync('token', data.token);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
  return data.token;
}

async function request(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401 and we have a refresh token, try to refresh
  if (res.status === 401 && !options._isRetry) {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (refreshToken) {
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
        // Refresh failed
      }
    }
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Push tokens
  registerPushToken: (token, device_name) =>
    request('/auth/push-token', { method: 'POST', body: JSON.stringify({ token, device_name }) }),
  removePushToken: (token) =>
    request('/auth/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),

  checkIn: () => request('/attendance/check-in', { method: 'POST' }),
  checkOut: () => request('/attendance/check-out', { method: 'POST' }),
  getToday: () => request('/attendance/today'),
  getHistory: (month, year) => request(`/attendance/history?month=${month}&year=${year}`),

  applyLeave: (data) => request('/leaves', { method: 'POST', body: JSON.stringify(data) }),
  getMyLeaves: (status) => request(`/leaves/my${status ? `?status=${status}` : ''}`),
  cancelLeave: (id) => request(`/leaves/${id}`, { method: 'DELETE' }),

  // Leave management (admin)
  getAllLeaves: (status) => request(`/leaves/all${status ? `?status=${status}` : ''}`),
  reviewLeave: (id, status, review_note) =>
    request(`/leaves/${id}/review`, { method: 'PUT', body: JSON.stringify({ status, review_note }) }),

  getStats: () => request('/dashboard/stats'),

  // Employees (admin)
  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) =>
    request(`/employees/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) }),

  // Holidays
  getHolidays: (year) => request(`/holidays?year=${year}`),

  // Design tasks (for designer)
  getMyDesignTasks: (year) => request(`/design-tasks/my${year ? `?year=${year}` : ''}`),
  updateDesignTaskStatus: (id, status) =>
    request(`/design-tasks/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};
