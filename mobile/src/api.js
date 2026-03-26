import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Reads from app.json extra.apiUrl, falls back to localhost for simulator
const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.3:3001/api';

async function getToken() {
  return await SecureStore.getItemAsync('token');
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

  checkIn: () => request('/attendance/check-in', { method: 'POST' }),
  checkOut: () => request('/attendance/check-out', { method: 'POST' }),
  getToday: () => request('/attendance/today'),
  getHistory: (month, year) => request(`/attendance/history?month=${month}&year=${year}`),

  applyLeave: (data) => request('/leaves', { method: 'POST', body: JSON.stringify(data) }),
  getMyLeaves: (status) => request(`/leaves/my${status ? `?status=${status}` : ''}`),
  cancelLeave: (id) => request(`/leaves/${id}`, { method: 'DELETE' }),

  getStats: () => request('/dashboard/stats'),

  // Employees (admin)
  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
