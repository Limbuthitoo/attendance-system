import { request } from './client';

export const employees = {
  getEmployees: () => request('/employees'),
  getEmployee: (id) => request(`/employees/${id}`),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) =>
    request(`/employees/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) }),
};

export const profile = {
  getMyProfile: () => request('/auth/profile'),
  updateMyProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  addEmergencyContact: (data) => request('/auth/profile/emergency-contacts', { method: 'POST', body: JSON.stringify(data) }),
  deleteEmergencyContact: (id) => request(`/auth/profile/emergency-contacts/${id}`, { method: 'DELETE' }),
};

export const dashboard = {
  getStats: () => request('/dashboard/stats'),
};
