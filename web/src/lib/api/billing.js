import { request } from './client';

export const billing = {
  // Parties
  getParties: (params) => request('/billing/parties', { params }),
  getParty: (id) => request(`/billing/parties/${id}`),
  createParty: (data) => request('/billing/parties', { method: 'POST', body: JSON.stringify(data) }),
  updateParty: (id, data) => request(`/billing/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Invoices
  getInvoices: (params) => request('/billing/invoices', { params }),
  getInvoice: (id) => request(`/billing/invoices/${id}`),
  createInvoice: (data) => request('/billing/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id, data) => request(`/billing/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  issueInvoice: (id) => request(`/billing/invoices/${id}/issue`, { method: 'POST' }),
  cancelInvoice: (id) => request(`/billing/invoices/${id}/cancel`, { method: 'POST' }),

  // Payments
  getPayments: (params) => request('/billing/payments', { params }),
  recordPayment: (data) => request('/billing/payments', { method: 'POST', body: JSON.stringify(data) }),
  voidPayment: (id) => request(`/billing/payments/${id}/void`, { method: 'POST' }),

  // Party Statement
  getPartyStatement: (id, params) => request(`/billing/parties/${id}/statement`, { params }),

  // Reports
  getAgingReport: (params) => request('/billing/reports/aging', { params }),
  getVatSummary: (params) => request('/billing/reports/vat-summary', { params }),
  getDayBook: (params) => request('/billing/reports/day-book', { params }),

  // Settings
  getSettings: () => request('/billing/settings'),
  updateSettings: (data) => request('/billing/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
