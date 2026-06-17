export const API_BASE_URL = 'http://10.28.237.185/absensi_backend/public/api/v1';

export const API_ENDPOINTS = {
  // Auth
  login:          `${API_BASE_URL}/login`,
  register:       `${API_BASE_URL}/register`,
  uploadFace:     `${API_BASE_URL}/register/face`,
  logout:         `${API_BASE_URL}/logout`,

  // Password reset
  forgotPassword: `${API_BASE_URL}/forgot-password`,
  resetPassword:  `${API_BASE_URL}/reset-password`,

  // Profile
  // Note: profile/photo/{user_id} (GET, serves the image) isn't called directly —
  // the absolute URL is always taken from profile_photo_url in the backend response.
  profile:         `${API_BASE_URL}/profile`,
  profilePhoto:    `${API_BASE_URL}/profile/photo`,
  profilePassword: `${API_BASE_URL}/profile/password`,
  deviceToken:     `${API_BASE_URL}/device-token`,

  // Ganti foto wajah referensi
  faceRequest: `${API_BASE_URL}/face-request`,

  // Notifications
  notifications:        `${API_BASE_URL}/notifications`,
  notificationRead:     (id: string) => `${API_BASE_URL}/notifications/${id}/read`,
  notificationReadAll:  `${API_BASE_URL}/notifications/read-all`,

  // Lokasi kantor (diambil sebelum check-in)
  officeLocations: `${API_BASE_URL}/office-locations`,

  // Attendance
  checkIn:    `${API_BASE_URL}/attendance/check-in`,
  checkOut:   `${API_BASE_URL}/attendance/check-out`,
  today:      `${API_BASE_URL}/attendance/today`,
  history:    `${API_BASE_URL}/attendance/history`,

  // Requests (cuti/izin/sakit/lembur)
  requests:       `${API_BASE_URL}/requests`,
  requestsQuota:  `${API_BASE_URL}/requests/quota`,
  requestDetail:  (id: number) => `${API_BASE_URL}/requests/${id}`,
  requestEnd:     (id: number) => `${API_BASE_URL}/requests/${id}/end`,
};
