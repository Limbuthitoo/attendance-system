// ─────────────────────────────────────────────────────────────────────────────
// Platform API Client — Talks to /api/platform endpoints
// ─────────────────────────────────────────────────────────────────────────────
const BASE = '/api/platform';

let accessToken = localStorage.getItem('platform_token');

function setToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem('platform_token', token);
  } else {
    localStorage.removeItem('platform_token');
  }
}

function getToken() {
  return accessToken;
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (!options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOpts = { ...options, headers, credentials: 'include' };
  delete fetchOpts.isFormData;

  const res = await fetch(`${BASE}${path}`, fetchOpts);

  // Auto-refresh on 401
  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request(path, { ...options, _retried: true });
    }
    // Redirect to platform login
    localStorage.removeItem('platform_token');
    localStorage.removeItem('platform_user');
    window.location.href = '/platform/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `Request failed (${res.status})`), {
      status: res.status,
    });
  }

  return res.json();
}

async function refreshToken() {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    setToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────
export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.accessToken);
  localStorage.setItem('platform_user', JSON.stringify(data.user));
  return data;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    setToken(null);
    localStorage.removeItem('platform_user');
  }
}

export async function getMe() {
  return request('/auth/me');
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  return request('/dashboard');
}

// ── Organizations ───────────────────────────────────────────────────────────
export async function getOrganizations(params = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.plan) qs.set('plan', params.plan);
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  return request(`/organizations?${qs.toString()}`);
}

export async function getOrganization(id) {
  return request(`/organizations/${id}`);
}

export async function createOrganization(data) {
  return request('/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOrganization(id, data) {
  return request(`/organizations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function suspendOrganization(id) {
  return request(`/organizations/${id}/suspend`, { method: 'PUT' });
}

export async function reactivateOrganization(id) {
  return request(`/organizations/${id}/reactivate`, { method: 'PUT' });
}

export async function setOrgModules(id, moduleCodes) {
  return request(`/organizations/${id}/modules`, {
    method: 'PUT',
    body: JSON.stringify({ moduleCodes }),
  });
}

// ── Modules ─────────────────────────────────────────────────────────────────
export async function getModules() {
  return request('/modules');
}

// ── Branches (via platform org routes) ──────────────────────────────────────
export async function getOrgBranches(orgId) {
  return request(`/organizations/${orgId}/branches`);
}

// ── Plans ───────────────────────────────────────────────────────────────────
export async function getPlans() {
  return request('/plans');
}

export async function getPlan(id) {
  return request(`/plans/${id}`);
}

export async function createPlan(data) {
  return request('/plans', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePlan(id, data) {
  return request(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePlan(id) {
  return request(`/plans/${id}`, { method: 'DELETE' });
}

// ── Billing ─────────────────────────────────────────────────────────────────
export async function getInvoices(params = {}) {
  const qs = new URLSearchParams();
  if (params.orgId) qs.set('orgId', params.orgId);
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  return request(`/billing?${qs.toString()}`);
}

export async function getBillingStats() {
  return request('/billing/stats');
}

export async function getInvoice(id) {
  return request(`/billing/${id}`);
}

export async function createInvoice(data) {
  return request('/billing', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateInvoice(id, data) {
  return request(`/billing/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function markInvoicePaid(id, data) {
  return request(`/billing/${id}/pay`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteInvoice(id) {
  return request(`/billing/${id}`, { method: 'DELETE' });
}

// ── Platform Users ──────────────────────────────────────────────────────────
export async function getPlatformUsers() {
  return request('/users');
}

export async function getPlatformUser(id) {
  return request(`/users/${id}`);
}

export async function createPlatformUser(data) {
  return request('/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePlatformUser(id, data) {
  return request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePlatformUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' });
}

export async function createOrgBranch(orgId, data) {
  return request(`/organizations/${orgId}/branches`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── App Update ──────────────────────────────────────────────────────────────
export async function getAppRelease() {
  return request('/app-update/current');
}

export async function uploadAppRelease(formData) {
  return request('/app-update/upload', { method: 'POST', body: formData, isFormData: true });
}

export async function deleteAppRelease() {
  return request('/app-update/current', { method: 'DELETE' });
}

export const platformApi = {
  getAppRelease,
  uploadAppRelease,
  deleteAppRelease,
};

export { getToken, setToken };
