import { request } from './client';

export const ess = {
  // Document Requests
  getDocumentRequests: (params) => request('/ess/documents', { params }),
  createDocumentRequest: (data) => request('/ess/documents', { method: 'POST', body: JSON.stringify(data) }),
  updateDocumentRequest: (id, data) => request(`/ess/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Expense Claims
  getExpenseClaims: (params) => request('/ess/expenses', { params }),
  createExpenseClaim: (data) => request('/ess/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpenseClaim: (id, data) => request(`/ess/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Assets
  getAssets: (params) => request('/ess/assets', { params }),
  createAsset: (data) => request('/ess/assets', { method: 'POST', body: JSON.stringify(data) }),
  updateAsset: (id, data) => request(`/ess/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assignAsset: (assetId, data) => request(`/ess/assets/${assetId}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  returnAsset: (assetId, data) => request(`/ess/assets/${assetId}/return`, { method: 'POST', body: JSON.stringify(data) }),
  getMyAssets: () => request('/ess/my-assets'),
};

export const orgChart = {
  getOrgChart: () => request('/org-chart'),
  updateDepartment: (employeeId, data) => request(`/org-chart/${employeeId}/department`, { method: 'PUT', body: JSON.stringify(data) }),
};
