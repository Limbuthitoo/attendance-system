import { request } from './client';

export const taxConfig = {
  getTaxConfigs: () => request('/tax-config'),
  createTaxConfig: (data) => request('/tax-config', { method: 'POST', body: JSON.stringify(data) }),
  updateTaxConfig: (id, data) => request(`/tax-config/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTaxConfig: (id) => request(`/tax-config/${id}`, { method: 'DELETE' }),
};

export const festivalAdvances = {
  getFestivalAdvances: (params) => request('/festival-advances', { params }),
  createFestivalAdvance: (data) => request('/festival-advances', { method: 'POST', body: JSON.stringify(data) }),
  updateFestivalAdvance: (id, data) => request(`/festival-advances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const compensation = {
  getPayGrades: () => request('/compensation/pay-grades'),
  createPayGrade: (data) => request('/compensation/pay-grades', { method: 'POST', body: JSON.stringify(data) }),
  updatePayGrade: (id, data) => request(`/compensation/pay-grades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayGrade: (id) => request(`/compensation/pay-grades/${id}`, { method: 'DELETE' }),
  getSalaryRevisions: (params) => request('/compensation/salary-revisions', { params }),
  createSalaryRevision: (data) => request('/compensation/salary-revisions', { method: 'POST', body: JSON.stringify(data) }),
  updateSalaryRevision: (id, data) => request(`/compensation/salary-revisions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getBenefits: () => request('/compensation/benefits'),
  createBenefit: (data) => request('/compensation/benefits', { method: 'POST', body: JSON.stringify(data) }),
  updateBenefit: (id, data) => request(`/compensation/benefits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBenefit: (id) => request(`/compensation/benefits/${id}`, { method: 'DELETE' }),
};
