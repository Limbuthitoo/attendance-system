import { request } from './client';

export const holidays = {
  getHolidays: (year) => request(`/holidays?year=${year}`),
};

export const notices = {
  getNotices: (limit, offset) => request(`/notices?limit=${limit || 50}&offset=${offset || 0}`),
  getNotice: (id) => request(`/notices/${id}`),
  createNotice: (data) => request('/notices', { method: 'POST', body: JSON.stringify(data) }),
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
