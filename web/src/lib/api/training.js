import { request } from './client';

export const training = {
  getCourses: () => request('/training/courses'),
  createCourse: (data) => request('/training/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id, data) => request(`/training/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourse: (id) => request(`/training/courses/${id}`, { method: 'DELETE' }),
  getSessions: (params) => request('/training/sessions', { params }),
  createSession: (data) => request('/training/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/training/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getEnrollments: (sessionId) => request(`/training/sessions/${sessionId}/enrollments`),
  enrollEmployees: (data) => request('/training/enroll', { method: 'POST', body: JSON.stringify(data) }),
  updateEnrollment: (id, data) => request(`/training/enrollments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCertifications: (params) => request('/training/certifications', { params }),
  createCertification: (data) => request('/training/certifications', { method: 'POST', body: JSON.stringify(data) }),
  updateCertification: (id, data) => request(`/training/certifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
