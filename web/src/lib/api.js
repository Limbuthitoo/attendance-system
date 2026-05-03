const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data.token;
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401 and we have a refresh token, try to refresh silently
  // Old sessions without refreshToken will just redirect to login
  if (res.status === 401 && localStorage.getItem('refreshToken') && !options._isRetry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    try {
      const newToken = await (refreshPromise || refreshAccessToken());
      // Retry the original request with the new token
      return request(endpoint, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
        _isRetry: true,
      });
    } catch {
      // Refresh failed, propagate the original error
    }
  }

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
  getEmployeeAttendance: (id, startDate, endDate) =>
    request(`/attendance/employee/${id}?${startDate ? `start_date=${startDate}` : ''}${endDate ? `&end_date=${endDate}` : ''}`),

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
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),

  // Dashboard
  getStats: () => request('/dashboard/stats'),
  getWeeklyTrend: (days = 7) => request(`/dashboard/weekly-trend?days=${days}`),
  getDepartmentStats: () => request('/dashboard/department-stats'),
  getLeaveStats: () => request('/dashboard/leave-stats'),

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
  getReaderStatus: () => request('/nfc/reader-status'),

  // NFC Write Jobs
  createWriteJob: (data) => request('/nfc/write-jobs', { method: 'POST', body: JSON.stringify(data) }),
  getWriteJobs: (status) => request(`/nfc/write-jobs${status ? `?status=${status}` : ''}`),
  cancelWriteJob: (id) => request(`/nfc/write-jobs/${id}/cancel`, { method: 'PUT' }),

  // Holidays
  getHolidays: (year) => request(`/holidays?year=${year || 2083}`),
  createHoliday: (data) => request('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  updateHoliday: (id, data) => request(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHoliday: (id) => request(`/holidays/${id}`, { method: 'DELETE' }),

  // Notices
  getNotices: (limit, offset) => request(`/notices?limit=${limit || 50}&offset=${offset || 0}`),
  getNotice: (id) => request(`/notices/${id}`),
  publishNotice: (data) => request('/notices', { method: 'POST', body: JSON.stringify(data) }),
  deleteNotice: (id) => request(`/notices/${id}`, { method: 'DELETE' }),

  // Notifications
  getNotifications: (limit, offset, unreadOnly) =>
    request(`/notifications?limit=${limit || 50}&offset=${offset || 0}${unreadOnly ? '&unread_only=1' : ''}`),
  getUnreadCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PUT' }),
  clearNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
  clearAllNotifications: () => request('/notifications', { method: 'DELETE' }),

  // Devices (v1 unified)
  getDevices: (branchId, deviceType) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (deviceType) params.set('deviceType', deviceType);
    return request(`/devices?${params}`);
  },
  getDevice: (id) => request(`/devices/${id}`),
  registerDevice: (data) => request('/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id, data) => request(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivateDevice: (id) => request(`/devices/${id}/deactivate`, { method: 'PUT' }),
  reactivateDevice: (id) => request(`/devices/${id}/reactivate`, { method: 'PUT' }),
  rotateDeviceKey: (id) => request(`/devices/${id}/rotate-key`, { method: 'POST' }),
  getDeviceAdapters: () => request('/devices/adapters/info'),

  // Device events
  getDeviceEvents: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return request(`/devices/events/list?${qs}`);
  },

  // Credentials
  getCredentials: (employeeId, credentialType) => {
    const params = new URLSearchParams();
    if (employeeId) params.set('employeeId', employeeId);
    if (credentialType) params.set('credentialType', credentialType);
    return request(`/devices/credentials?${params}`);
  },
  assignCredential: (data) => request('/devices/credentials', { method: 'POST', body: JSON.stringify(data) }),
  deactivateCredential: (id) => request(`/devices/credentials/${id}`, { method: 'DELETE' }),

  // Branches
  getBranches: () => request('/branches'),

  // Shifts
  getShifts: () => request('/settings/shifts'),

  // Work Schedules
  getWorkSchedules: () => request('/settings/work-schedules'),

  // Assignments
  getAssignments: (filters) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    return request(`/settings/assignments?${params}`);
  },

  // Reports
  getAttendanceSummary: (params) => {
    const qs = new URLSearchParams(params);
    return request(`/reports/attendance-summary?${qs}`);
  },
  getDepartmentReport: (startDate, endDate) => request(`/reports/department?startDate=${startDate}&endDate=${endDate}`),
  getDailyTrend: (startDate, endDate, branchId) => {
    const qs = new URLSearchParams({ startDate, endDate });
    if (branchId) qs.set('branchId', branchId);
    return request(`/reports/daily-trend?${qs}`);
  },
  getLateArrivals: (startDate, endDate, minLateCount) =>
    request(`/reports/late-arrivals?startDate=${startDate}&endDate=${endDate}${minLateCount ? `&minLateCount=${minLateCount}` : ''}`),
  getLeaveReport: (year) => request(`/reports/leaves?year=${year}`),
  exportAttendanceCsv: (startDate, endDate, branchId) => {
    const qs = new URLSearchParams({ startDate, endDate });
    if (branchId) qs.set('branchId', branchId);
    return request(`/reports/export/attendance?${qs}`, {}, true);
  },

  // Overtime
  getOvertimePolicies: () => request('/overtime/policies'),
  createOvertimePolicy: (data) => request('/overtime/policies', { method: 'POST', body: JSON.stringify(data) }),
  updateOvertimePolicy: (id, data) => request(`/overtime/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getOvertimeRecords: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return request(`/overtime/records?${qs}`);
  },
  getMyOvertime: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return request(`/overtime/my?${qs}`);
  },
  reviewOvertime: (id, status) => request(`/overtime/records/${id}/review`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getOvertimeSummary: (startDate, endDate) => request(`/overtime/summary?startDate=${startDate}&endDate=${endDate}`),

  // Geofence
  getGeofences: () => request('/geofence'),
  getGeofence: (branchId) => request(`/geofence/${branchId}`),
  updateGeofence: (branchId, data) => request(`/geofence/${branchId}`, { method: 'PUT', body: JSON.stringify(data) }),
  validateGeofence: (latitude, longitude) =>
    request('/geofence/validate', { method: 'POST', body: JSON.stringify({ latitude, longitude }) }),

  // Payroll
  generatePayroll: (year, month) => request('/payroll/generate', { method: 'POST', body: JSON.stringify({ year, month }) }),
  getPayrollSummaries: (year, month, department) => {
    const qs = new URLSearchParams({ year, month });
    if (department) qs.set('department', department);
    return request(`/payroll/summaries?${qs}`);
  },
  exportPayrollCsv: (year, month) => request(`/payroll/export?year=${year}&month=${month}`, {}, true),
};
