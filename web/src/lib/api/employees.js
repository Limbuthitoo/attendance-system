import { request } from './client';

export const employees = {
  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivateEmployee: (id) => request(`/employees/${id}/deactivate`, { method: 'POST' }),
  activateEmployee: (id) => request(`/employees/${id}/activate`, { method: 'POST' }),
  resetPassword: (id, password) => request(`/employees/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password }) }),
  unlockAccount: (id) => request(`/employees/${id}/unlock`, { method: 'POST' }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
};

export const departments = {
  getDepartments: () => request('/departments'),
  createDepartment: (data) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id, data) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
};

export const designations = {
  getDesignations: () => request('/designations'),
  createDesignation: (data) => request('/designations', { method: 'POST', body: JSON.stringify(data) }),
  updateDesignation: (id, data) => request(`/designations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDesignation: (id) => request(`/designations/${id}`, { method: 'DELETE' }),
};
