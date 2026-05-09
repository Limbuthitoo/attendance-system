import { request } from './client';

export const incentives = {
  // Plans
  getPlans: (params) => request(`/v1/incentives/plans${params ? '?' + new URLSearchParams(params) : ''}`),
  getPlan: (id) => request(`/v1/incentives/plans/${id}`),
  createPlan: (data) => request('/v1/incentives/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (id, data) => request(`/v1/incentives/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlan: (id) => request(`/v1/incentives/plans/${id}`, { method: 'DELETE' }),

  // Calculation
  calculate: (data) => request('/v1/incentives/calculate', { method: 'POST', body: JSON.stringify(data) }),

  // Records
  listIncentives: (params) => request(`/v1/incentives?${new URLSearchParams(params)}`),
  getMyIncentives: (params) => request(`/v1/incentives/my${params ? '?' + new URLSearchParams(params) : ''}`),

  // Approval
  review: (id, data) => request(`/v1/incentives/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
  bulkReview: (data) => request('/v1/incentives/bulk-review', { method: 'POST', body: JSON.stringify(data) }),

  // Adjustments
  adjust: (id, data) => request(`/v1/incentives/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),

  // Summary
  getSummary: (params) => request(`/v1/incentives/summary${params ? '?' + new URLSearchParams(params) : ''}`),
};
