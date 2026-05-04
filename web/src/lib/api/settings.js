import { request } from './client';

export const branches = {
  getBranches: () => request('/branches'),
};

export const shifts = {
  getShifts: () => request('/settings/shifts'),
};

export const workSchedules = {
  getWorkSchedules: () => request('/settings/work-schedules'),
};

export const assignments = {
  getAssignments: (filters) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    return request(`/settings/assignments?${params}`);
  },
};
