import axios from 'axios';
import { useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
export function useApiClient() {
  const { getToken } = useAuth();

  api.interceptors.request.use(
    async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  return api;
}

// API methods
export const authApi = {
  syncUser: () => api.post('/auth/sync'),
  getProfile: () => api.get('/auth/me'),
};

export const userApi = {
  searchUsers: (query: string) => api.get(`/users?q=${query}`),
  getUser: (userId: string) => api.get(`/users/${userId}`),
  updateProfile: (data: any) => api.patch('/users/profile', data),
  getConversations: () => api.get('/users/conversations/list'),
};

export const messageApi = {
  getMessages: (conversationId: string, limit = 50, offset = 0) =>
    api.get(`/messages/conversation/${conversationId}?limit=${limit}&offset=${offset}`),
  createConversation: (userId: string) =>
    api.post('/messages/conversation', { userId }),
  markAsRead: (conversationId: string) =>
    api.post(`/messages/conversation/${conversationId}/read`),
  deleteMessage: (messageId: string) =>
    api.delete(`/messages/${messageId}`),
  getUnreadCounts: () => api.get('/messages/unread'),
};

export const uploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteImage: (url: string) =>
    api.delete('/upload/image', { data: { url } }),
};

export const notificationApi = {
  registerToken: (token: string, deviceType: string) =>
    api.post('/notifications/register-token', { token, deviceType }),
  removeToken: (token: string) =>
    api.post('/notifications/remove-token', { token }),
};

export default api;
