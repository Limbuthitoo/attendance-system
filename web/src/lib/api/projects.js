import { request } from './client';

export const projects = {
  getProjects: (params) => request(`/v1/projects${params ? '?' + new URLSearchParams(params) : ''}`),
  getProject: (id) => request(`/v1/projects/${id}`),
  createProject: (data) => request('/v1/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/v1/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/v1/projects/${id}`, { method: 'DELETE' }),
  addMember: (projectId, data) => request(`/v1/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  removeMember: (projectId, memberId) => request(`/v1/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
};
