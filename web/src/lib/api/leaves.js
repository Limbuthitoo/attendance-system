import { request } from './client';

export const leaves = {
  applyLeave: (data) => request('/leaves', { method: 'POST', body: JSON.stringify(data) }),
  getMyLeaves: (status) => request(`/leaves/my${status ? `?status=${status}` : ''}`),
  getAllLeaves: (status) => request(`/leaves/all${status ? `?status=${status}` : ''}`),
  reviewLeave: (id, status, review_note) =>
    request(`/leaves/${id}/review`, { method: 'PUT', body: JSON.stringify({ status, review_note }) }),
  cancelLeave: (id) => request(`/leaves/${id}`, { method: 'DELETE' }),
};
