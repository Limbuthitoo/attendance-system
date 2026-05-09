import { request } from './client';

export const performance = {
  // KPIs
  getKpis: (params) => request(`/v1/performance/kpis${params ? '?' + new URLSearchParams(params) : ''}`),
  createKpi: (data) => request('/v1/performance/kpis', { method: 'POST', body: JSON.stringify(data) }),
  updateKpi: (id, data) => request(`/v1/performance/kpis/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteKpi: (id) => request(`/v1/performance/kpis/${id}`, { method: 'DELETE' }),

  // Scores
  getScores: (params) => request(`/v1/performance/scores?${new URLSearchParams(params)}`),
  upsertScore: (data) => request('/v1/performance/scores', { method: 'POST', body: JSON.stringify(data) }),

  // Review Cycles
  getCycles: (params) => request(`/v1/performance/cycles${params ? '?' + new URLSearchParams(params) : ''}`),
  createCycle: (data) => request('/v1/performance/cycles', { method: 'POST', body: JSON.stringify(data) }),
  updateCycle: (id, data) => request(`/v1/performance/cycles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Reviews
  getReviews: (params) => request(`/v1/performance/reviews${params ? '?' + new URLSearchParams(params) : ''}`),
  createReview: (data) => request('/v1/performance/reviews', { method: 'POST', body: JSON.stringify(data) }),
  updateReview: (id, data) => request(`/v1/performance/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
