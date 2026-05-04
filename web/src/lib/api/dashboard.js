import { request } from './client';

export const dashboard = {
  getStats: () => request('/dashboard/stats'),
  getWeeklyTrend: (days = 7) => request(`/dashboard/weekly-trend?days=${days}`),
  getDepartmentStats: () => request('/dashboard/department-stats'),
  getLeaveStats: () => request('/dashboard/leave-stats'),
};
