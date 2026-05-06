import { request } from './client';

export const holidays = {
  getHolidays: (year) => request(`/holidays?year=${year || 2083}`),
  createHoliday: (data) => request('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  updateHoliday: (id, data) => request(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHoliday: (id) => request(`/holidays/${id}`, { method: 'DELETE' }),
};

export const notices = {
  getNotices: (limit, offset) => request(`/notices?limit=${limit || 50}&offset=${offset || 0}`),
  getNotice: (id) => request(`/notices/${id}`),
  publishNotice: (data) => request('/notices', { method: 'POST', body: JSON.stringify(data) }),
  deleteNotice: (id) => request(`/notices/${id}`, { method: 'DELETE' }),
};

export const notifications = {
  getNotifications: (limit, offset, unreadOnly) =>
    request(`/notifications?limit=${limit || 50}&offset=${offset || 0}${unreadOnly ? '&unread_only=1' : ''}`),
  getUnreadCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),
  clearNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
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
