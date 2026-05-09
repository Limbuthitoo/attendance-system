import { request } from './client';

export const auth = {
  login: (email, password, orgSlug) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, orgSlug }) }),
  getMe: () => request('/auth/me'),
  getMyProfile: () => request('/auth/profile'),
  updateMyProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  addEmergencyContact: (data) => request('/auth/profile/emergency-contacts', { method: 'POST', body: JSON.stringify(data) }),
  deleteEmergencyContact: (id) => request(`/auth/profile/emergency-contacts/${id}`, { method: 'DELETE' }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
};
