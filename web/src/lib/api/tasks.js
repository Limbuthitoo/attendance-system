import { request } from './client';

export const tasks = {
  getTasks: (params) => request(`/v1/tasks${params ? '?' + new URLSearchParams(params) : ''}`),
  getMyTasks: (params) => request(`/v1/tasks/my${params ? '?' + new URLSearchParams(params) : ''}`),
  getTask: (id) => request(`/v1/tasks/${id}`),
  createTask: (data) => request('/v1/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/v1/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/v1/tasks/${id}`, { method: 'DELETE' }),
};
