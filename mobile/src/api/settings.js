import { request } from './client';

export const settings = {
  getMyAssignment: () => request('/settings/assignments/employee/me'),
  getShifts: () => request('/settings/shifts'),
  getWorkSchedules: () => request('/settings/work-schedules'),
  getBranches: () => request('/branches'),
};

export const qr = {
  getMyQrCode: () => request('/qr/my-code', { method: 'POST' }),
  scanLocationQr: (qrToken, latitude, longitude) =>
    request('/qr/scan', { method: 'POST', body: JSON.stringify({ qrToken, latitude, longitude }) }),
};

export const geofence = {
  validateGeofence: (latitude, longitude) =>
    request('/geofence/validate', { method: 'POST', body: JSON.stringify({ latitude, longitude }) }),
};

export const reports = {
  getAttendanceSummary: (startDate, endDate, branchId) => {
    const q = new URLSearchParams({ startDate, endDate });
    if (branchId) q.append('branchId', branchId);
    return request(`/reports/attendance-summary?${q}`);
  },
};

export const overtime = {
  getMyOvertime: (page = 1) => request(`/overtime/my?page=${page}`),
  getOvertimeSummary: (startDate, endDate) =>
    request(`/overtime/summary?startDate=${startDate}&endDate=${endDate}`),
};
