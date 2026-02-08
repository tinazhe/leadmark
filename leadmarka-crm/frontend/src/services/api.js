import axios from 'axios';

// Defensive trim: environment variables can include trailing whitespace/newlines
// (e.g. from copy/paste into hosting dashboards).
const API_URL = (process.env.REACT_APP_API_URL || '/api').trim();

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

// Handle 401 and 402 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthRequest = /^\/?auth\/(login|register|forgot-password|reset-password)/.test(url);
      if (!isAuthRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    // Subscription expired — redirect to Settings so user can pay
    if (error.response?.status === 402) {
      const code = error.response?.data?.code;
      if (code === 'SUBSCRIPTION_REQUIRED' && !window.location.pathname.startsWith('/settings')) {
        window.location.href = '/settings?subscription=required';
      }
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
  getInbox: (params) => api.get('/leads/inbox', { params }),
  getById: (id) => api.get(`/leads/${id}`),
  getViewers: (id) => api.get(`/leads/${id}/viewers`),
  postViewing: (id) => api.post(`/leads/${id}/viewing`),
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
  assign: (id, assignedUserId) => api.patch(`/leads/${id}/assign`, { assignedUserId }),
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

// Workspace API
export const workspaceAPI = {
  getMe: () => api.get('/workspace/me'),
  getMembers: () => api.get('/workspace/members'),
  invite: (email) => api.post('/workspace/invite', { email }),
  getInvites: () => api.get('/workspace/invites'),
  removeMember: (userId) => api.delete(`/workspace/members/${userId}`),
  updateSettings: (data) => api.put('/workspace/settings', data),
};

// Activity API
export const activityAPI = {
  getByLead: (leadId) => api.get(`/activity/lead/${leadId}`),
};

// Billing API
export const billingAPI = {
  getMe: () => api.get('/billing/me'),
  startEcocash: (data) => api.post('/billing/paynow/ecocash', data),
  getTransaction: (reference) => api.get(`/billing/transactions/${reference}`),
};

export default api;
