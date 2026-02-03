import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

const normalizeStatus = (status) => (
  typeof status === 'string' ? status.trim().toLowerCase() : status
);

const normalizeDate = (date) => {
  if (typeof date !== 'string') return date;
  const trimmed = date.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('T')) return trimmed.split('T')[0];
  return trimmed;
};

const normalizeTime = (time) => {
  if (typeof time !== 'string') return time;
  const trimmed = time.trim();
  if (!trimmed) return trimmed;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

// Leads API
export const leadsAPI = {
  getAll: (params) => api.get('/leads', { params }),
  getById: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', {
    ...data,
    status: normalizeStatus(data?.status),
  }),
  update: (id, data) => {
    const payload = { ...data };
    if (payload.status !== undefined) {
      payload.status = normalizeStatus(payload.status);
    }
    return api.put(`/leads/${id}`, payload);
  },
  markWhatsappContactNow: (id) => api.patch(`/leads/${id}/whatsapp-contact`),
  delete: (id) => api.delete(`/leads/${id}`),
};

// Follow-ups API
export const followUpsAPI = {
  getByLead: (leadId) => api.get(`/followups/lead/${leadId}`),
  create: (data) => api.post('/followups', {
    ...data,
    date: normalizeDate(data?.date),
    time: normalizeTime(data?.time),
  }),
  update: (id, data) => api.put(`/followups/${id}`, {
    ...data,
    date: normalizeDate(data?.date),
    time: normalizeTime(data?.time),
  }),
  complete: (id) => api.patch(`/followups/${id}/complete`),
  delete: (id) => api.delete(`/followups/${id}`),
};

// Notes API
export const notesAPI = {
  getByLead: (leadId) => api.get(`/notes/lead/${leadId}`),
  create: (data) => api.post('/notes', data),
  update: (id, content) => api.put(`/notes/${id}`, { content }),
  delete: (id) => api.delete(`/notes/${id}`),
};

// Dashboard API
export const dashboardAPI = {
  getToday: () => api.get('/dashboard/today'),
  getStats: () => api.get('/dashboard/stats'),
};

export default api;
