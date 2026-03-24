const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  // Raw request helper (used by ActivityLog etc.)
  _request: (endpoint, options) => request(endpoint, options),

  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Attendance
  checkIn: () => request('/attendance/check-in', { method: 'POST' }),
  checkOut: () => request('/attendance/check-out', { method: 'POST' }),
  getToday: () => request('/attendance/today'),
  getHistory: (month, year) => request(`/attendance/history?month=${month}&year=${year}`),
  getAllAttendance: (date) => request(`/attendance/all?date=${date}`),

  // Leaves
  applyLeave: (data) => request('/leaves', { method: 'POST', body: JSON.stringify(data) }),
  getMyLeaves: (status) => request(`/leaves/my${status ? `?status=${status}` : ''}`),
  getAllLeaves: (status) => request(`/leaves/all${status ? `?status=${status}` : ''}`),
  reviewLeave: (id, status, review_note) =>
    request(`/leaves/${id}/review`, { method: 'PUT', body: JSON.stringify({ status, review_note }) }),
  cancelLeave: (id) => request(`/leaves/${id}`, { method: 'DELETE' }),

  // Employees
  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword: (id, password) => request(`/employees/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) }),

  // Dashboard
  getStats: () => request('/dashboard/stats'),

  // NFC Cards
  getNfcCards: () => request('/nfc/cards'),
  getEmployeeNfcCards: (employeeId) => request(`/nfc/cards/employee/${employeeId}`),
  assignNfcCard: (data) => request('/nfc/cards', { method: 'POST', body: JSON.stringify(data) }),
  deactivateNfcCard: (id) => request(`/nfc/cards/${id}/deactivate`, { method: 'PUT' }),
  activateNfcCard: (id) => request(`/nfc/cards/${id}/activate`, { method: 'PUT' }),
  deleteNfcCard: (id) => request(`/nfc/cards/${id}`, { method: 'DELETE' }),
  getNfcTapLog: (date) => request(`/nfc/tap-log${date ? `?date=${date}` : ''}`),
  getNfcReaders: () => request('/nfc/readers'),
  registerNfcReader: (data) => request('/nfc/readers', { method: 'POST', body: JSON.stringify(data) }),

  // NFC Write Jobs
  createWriteJob: (data) => request('/nfc/write-jobs', { method: 'POST', body: JSON.stringify(data) }),
  getWriteJobs: (status) => request(`/nfc/write-jobs${status ? `?status=${status}` : ''}`),
  cancelWriteJob: (id) => request(`/nfc/write-jobs/${id}/cancel`, { method: 'PUT' }),
};
