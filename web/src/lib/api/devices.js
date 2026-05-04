import { request } from './client';

export const devices = {
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
  getDeviceEvents: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return request(`/devices/events/list?${qs}`);
  },
  getCredentials: (employeeId, credentialType) => {
    const params = new URLSearchParams();
    if (employeeId) params.set('employeeId', employeeId);
    if (credentialType) params.set('credentialType', credentialType);
    return request(`/devices/credentials?${params}`);
  },
  assignCredential: (data) => request('/devices/credentials', { method: 'POST', body: JSON.stringify(data) }),
  deactivateCredential: (id) => request(`/devices/credentials/${id}`, { method: 'DELETE' }),
};

export const nfc = {
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
  createWriteJob: (data) => request('/nfc/write-jobs', { method: 'POST', body: JSON.stringify(data) }),
  getWriteJobs: (status) => request(`/nfc/write-jobs${status ? `?status=${status}` : ''}`),
  cancelWriteJob: (id) => request(`/nfc/write-jobs/${id}/cancel`, { method: 'PUT' }),
};
