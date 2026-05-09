import { request } from './client';

export const bonuses = {
  // Plans
  getBonusPlans: (params) => request('/bonuses/plans', { params }),
  getBonusPlan: (id) => request(`/bonuses/plans/${id}`),
  createBonusPlan: (data) => request('/bonuses/plans', { method: 'POST', body: JSON.stringify(data) }),
  updateBonusPlan: (id, data) => request(`/bonuses/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBonusPlan: (id) => request(`/bonuses/plans/${id}`, { method: 'DELETE' }),

  // Calculate
  calculateBonuses: (planId, data) => request(`/bonuses/plans/${planId}/calculate`, { method: 'POST', body: JSON.stringify(data) }),

  // Records
  getBonusRecords: (params) => request('/bonuses/records', { params }),
  getMyBonuses: (params) => request('/bonuses/my', { params }),

  // Approval
  reviewBonus: (id, data) => request(`/bonuses/records/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
  bulkReviewBonuses: (data) => request('/bonuses/records/bulk-review', { method: 'POST', body: JSON.stringify(data) }),
  markBonusesPaid: (data) => request('/bonuses/records/mark-paid', { method: 'POST', body: JSON.stringify(data) }),

  // Summary
  getBonusSummary: (params) => request('/bonuses/summary', { params }),
};
