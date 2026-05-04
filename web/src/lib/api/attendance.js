import { request } from './client';

export const attendance = {
  checkIn: () => request('/attendance/check-in', { method: 'POST' }),
  checkOut: () => request('/attendance/check-out', { method: 'POST' }),
  getToday: () => request('/attendance/today'),
  getHistory: (month, year) => request(`/attendance/history?month=${month}&year=${year}`),
  getAllAttendance: (date) => request(`/attendance/all?date=${date}`),
  getEmployeeAttendance: (id, startDate, endDate) =>
    request(`/attendance/employee/${id}?${startDate ? `start_date=${startDate}` : ''}${endDate ? `&end_date=${endDate}` : ''}`),
};
