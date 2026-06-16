export const API_BASE_URL = 'http://192.168.1.6/absensi_backend/public/api/v1';

export const API_ENDPOINTS = {
  login:      `${API_BASE_URL}/login`,
  register:   `${API_BASE_URL}/register`,
  uploadFace: `${API_BASE_URL}/register/face`,
  checkIn:    `${API_BASE_URL}/attendance/check-in`,
  checkOut:   `${API_BASE_URL}/attendance/check-out`,
  today:      `${API_BASE_URL}/attendance/today`,
  history:    `${API_BASE_URL}/attendance/history`,
  requests:       `${API_BASE_URL}/requests`,
  requestsQuota:  `${API_BASE_URL}/requests/quota`,
  requestDetail:  (id: number) => `${API_BASE_URL}/requests/${id}`,
};