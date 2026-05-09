import { request } from './client';

export const recruitment = {
  getJobs: (params) => request('/recruitment/jobs', { params }),
  createJob: (data) => request('/recruitment/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id, data) => request(`/recruitment/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteJob: (id) => request(`/recruitment/jobs/${id}`, { method: 'DELETE' }),
  getApplicants: (params) => request('/recruitment/applicants', { params }),
  createApplicant: (data) => request('/recruitment/applicants', { method: 'POST', body: JSON.stringify(data) }),
  updateApplicant: (id, data) => request(`/recruitment/applicants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getInterviews: (params) => request('/recruitment/interviews', { params }),
  createInterview: (data) => request('/recruitment/interviews', { method: 'POST', body: JSON.stringify(data) }),
  updateInterview: (id, data) => request(`/recruitment/interviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const onboarding = {
  getTemplates: () => request('/onboarding/templates'),
  createTemplate: (data) => request('/onboarding/templates', { method: 'POST', body: JSON.stringify(data) }),
  getTasks: (params) => request('/onboarding/tasks', { params }),
  assignTemplate: (data) => request('/onboarding/assign', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/onboarding/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const separation = {
  getSeparations: (params) => request('/separation', { params }),
  createSeparation: (data) => request('/separation', { method: 'POST', body: JSON.stringify(data) }),
  updateSeparation: (id, data) => request(`/separation/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getClearanceItems: (separationId) => request(`/separation/${separationId}/clearance`),
  addClearanceItem: (separationId, data) => request(`/separation/${separationId}/clearance`, { method: 'POST', body: JSON.stringify(data) }),
  updateClearanceItem: (itemId, data) => request(`/separation/clearance/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSettlement: (separationId) => request(`/separation/${separationId}/settlement`),
  createSettlement: (separationId, data) => request(`/separation/${separationId}/settlement`, { method: 'POST', body: JSON.stringify(data) }),
  updateSettlement: (id, data) => request(`/separation/settlement/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
