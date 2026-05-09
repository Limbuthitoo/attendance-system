import { request } from './client';

export const holidays = {
  getHolidays: (year) => request(`/holidays?year=${year || 2083}`),
  createHoliday: (data) => request('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  updateHoliday: (id, data) => request(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHoliday: (id) => request(`/holidays/${id}`, { method: 'DELETE' }),
};

export const notices = {
  getNotices: (limit, offset) => request(`/notices?limit=${limit || 50}&offset=${offset || 0}`),
  publishNotice: (data) => request('/notices', { method: 'POST', body: JSON.stringify(data) }),
  deleteNotice: (id) => request(`/notices/${id}`, { method: 'DELETE' }),
};

export const notifications = {
  getNotifications: (limit, offset, unreadOnly) =>
    request(`/notifications?limit=${limit || 50}&offset=${offset || 0}${unreadOnly ? '&unread_only=true' : ''}`),
  getUnreadCount: () => request('/notifications/unread-count'),
  markNotificationsRead: (ids) => request('/notifications/read', { method: 'PUT', body: JSON.stringify({ ids }) }),
  clearAllNotifications: () => request('/notifications', { method: 'DELETE' }),
};

export const policies = {
  getPolicies: (category) => request(`/policies${category ? `?category=${category}` : ''}`),
  getAllPolicies: () => request('/policies/all'),
  getPolicy: (id) => request(`/policies/${id}`),
  createPolicy: (data) => request('/policies', { method: 'POST', body: JSON.stringify(data) }),
  updatePolicy: (id, data) => request(`/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePolicy: (id) => request(`/policies/${id}`, { method: 'DELETE' }),
};
