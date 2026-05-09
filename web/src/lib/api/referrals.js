import { request } from './client';

export const referrals = {
  getReferrals: (params) => request(`/v1/referrals${params ? '?' + new URLSearchParams(params) : ''}`),
  getMyReferrals: () => request('/v1/referrals/my'),
  createReferral: (data) => request('/v1/referrals', { method: 'POST', body: JSON.stringify(data) }),
  updateReferral: (id, data) => request(`/v1/referrals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReferral: (id) => request(`/v1/referrals/${id}`, { method: 'DELETE' }),
};
