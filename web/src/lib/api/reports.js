import { request } from './client';

export const reports = {
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
};

export const overtime = {
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
};

export const geofence = {
  getGeofences: () => request('/geofence'),
  getGeofence: (branchId) => request(`/geofence/${branchId}`),
  updateGeofence: (branchId, data) => request(`/geofence/${branchId}`, { method: 'PUT', body: JSON.stringify(data) }),
  validateGeofence: (latitude, longitude) =>
    request('/geofence/validate', { method: 'POST', body: JSON.stringify({ latitude, longitude }) }),
};

export const payroll = {
  generatePayroll: (year, month) => request('/payroll/generate', { method: 'POST', body: JSON.stringify({ year, month }) }),
  getPayrollSummaries: (year, month, department) => {
    const qs = new URLSearchParams({ year, month });
    if (department) qs.set('department', department);
    return request(`/payroll/summaries?${qs}`);
  },
  exportPayrollCsv: (year, month) => request(`/payroll/export?year=${year}&month=${month}`, {}, true),
};
