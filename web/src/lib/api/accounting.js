import { request } from './client';

export const accounting = {
  // Fiscal Years
  getFiscalYears: () => request('/accounting/fiscal-years'),
  createFiscalYear: (data) => request('/accounting/fiscal-years', { method: 'POST', body: JSON.stringify(data) }),
  updateFiscalYear: (id, data) => request(`/accounting/fiscal-years/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  closeFiscalYear: (id) => request(`/accounting/fiscal-years/${id}/close`, { method: 'POST' }),

  // Chart of Accounts
  getAccounts: (params) => request('/accounting/accounts', { params }),
  createAccount: (data) => request('/accounting/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) => request(`/accounting/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => request(`/accounting/accounts/${id}`, { method: 'DELETE' }),
  seedDefaultAccounts: () => request('/accounting/accounts/seed-defaults', { method: 'POST' }),

  // Journal Entries
  getJournalEntries: (params) => request('/accounting/journals', { params }),
  createJournalEntry: (data) => request('/accounting/journals', { method: 'POST', body: JSON.stringify(data) }),
  postJournalEntry: (id) => request(`/accounting/journals/${id}/post`, { method: 'POST' }),
  voidJournalEntry: (id) => request(`/accounting/journals/${id}/void`, { method: 'POST' }),

  // Reports
  getLedger: (accountId, params) => request(`/accounting/ledger/${accountId}`, { params }),
  getTrialBalance: (params) => request('/accounting/reports/trial-balance', { params }),
  getProfitAndLoss: (params) => request('/accounting/reports/profit-loss', { params }),
  getBalanceSheet: (params) => request('/accounting/reports/balance-sheet', { params }),
};
