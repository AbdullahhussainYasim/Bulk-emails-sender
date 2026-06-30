import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
});

// Add a request interceptor to attach the JWT token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auth Endpoints
export const login = (data) => api.post('/auth/login', data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');

export const getStats = () => api.get('/dashboard/stats');
export const getAccounts = () => api.get('/accounts');
export const addAccount = (data) => api.post('/accounts', data);
export const updateAccount = (id, data) => api.put(`/accounts/${id}`, data);
export const deleteAccount = (id) => api.delete(`/accounts/${id}`);
export const getClients = (params) => api.get('/clients', { params });
export const uploadClients = (formData) => api.post('/clients/upload', formData, {
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});
export const deleteClient = (id) => api.delete(`/clients/${id}`);
export const resetClient = (id) => api.post(`/clients/${id}/reset`);
export const getTemplates = () => api.get('/template');
export const getTemplate = (id) => api.get(`/template/${id}`);
export const addTemplate = (data) => api.post('/template', data);
export const updateTemplate = (id, data) => api.put(`/template/${id}`, data);
export const deleteTemplate = (id) => api.delete(`/template/${id}`);
export const setActiveTemplate = (id) => api.post(`/template/${id}/active`);
export const startSending = () => api.post('/send/start');
export const stopSending = () => api.post('/send/stop');
export const getStatus = () => api.get('/send/status');
export const getLogs = (params) => api.get('/logs', { params });
export const getInbox = (accountId, page = 1, limit = 50) => api.get(`/inbox/${accountId}?page=${page}&limit=${limit}`);
export const getEmailDetail = (accountId, emailId) => api.get(`/inbox/${accountId}/email/${emailId}`);
export const getThread = (accountId, threadId) => api.get(`/inbox/${accountId}/thread/${threadId}`);
export const replyToEmail = (accountId, replyData) => api.post(`/inbox/${accountId}/reply`, replyData);
export const getUnseenCount = () => api.get('/inbox/unseen-count');

export default api;
