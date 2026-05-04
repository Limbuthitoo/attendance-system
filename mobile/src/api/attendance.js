import { request } from './client';

export const attendance = {
  checkIn: (latitude, longitude) =>
    request('/attendance/check-in', { method: 'POST', body: JSON.stringify({ latitude, longitude }) }),
  checkOut: () => request('/attendance/check-out', { method: 'POST' }),
  getToday: () => request('/attendance/today'),
  getHistory: (params = {}) => {
    const q = new URLSearchParams();
    if (params.start_date) q.append('start_date', params.start_date);
    if (params.end_date) q.append('end_date', params.end_date);
    if (params.month) q.append('month', params.month);
    if (params.year) q.append('year', params.year);
    return request(`/attendance/history?${q.toString()}`);
  },
  getAllAttendance: (date, department) => {
    let url = `/attendance/all?date=${date}`;
    if (department) url += `&department=${encodeURIComponent(department)}`;
    return request(url);
  },
};
