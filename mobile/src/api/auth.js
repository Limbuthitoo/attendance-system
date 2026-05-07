import { request } from './client';

export const auth = {
  login: (email, password, orgSlug) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, orgSlug }) }),
  getOrganizations: () => request('/auth/organizations'),
  getMe: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  registerPushToken: (token, device_name) =>
    request('/auth/push-token', { method: 'POST', body: JSON.stringify({ token, device_name }) }),
  removePushToken: (token) =>
    request('/auth/push-token', { method: 'DELETE', body: JSON.stringify({ token }) }),
};
