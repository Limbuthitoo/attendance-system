import { request } from './client';

export const employees = {
  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword: (id, password) => request(`/employees/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  unlockAccount: (id) => request(`/employees/${id}/unlock`, { method: 'POST' }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
};
