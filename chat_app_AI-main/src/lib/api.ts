import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import React from 'react';

// Use Next.js API routes only (serverless)
const API_URL = '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
export function useApiClient() {
  const { getToken } = useAuth();
  const interceptorId = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Eject previous interceptor if exists
    if (interceptorId.current !== null) {
      api.interceptors.request.eject(interceptorId.current);
    }

    // Add new interceptor
    interceptorId.current = api.interceptors.request.use(
      async (config) => {
        try {
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Cleanup on unmount or when getToken changes
    return () => {
      if (interceptorId.current !== null) {
        api.interceptors.request.eject(interceptorId.current);
        interceptorId.current = null;
      }
    };
  }, [getToken]);

  return api;
}

// API methods
export const authApi = {
  syncUser: () => api.post('/auth/sync'),
  getProfile: () => api.get('/users/me'),
};

export const userApi = {
  searchUsers: (query: string) => api.get(`/users?q=${query}`),
  getUser: (userId: string) => api.get(`/users/${userId}`),
  updateProfile: (data: any) => api.patch('/users/profile', data),
  getConversations: () => api.get('/users/conversations'),
};

export const messageApi = {
  getMessages: (conversationId: string, limit = 50, offset = 0) =>
    api.get(`/messages?limit=${limit}&offset=${offset}`),
  sendMessage: (content: string, mediaUrl?: string) =>
    api.post('/send-message', { content, mediaUrl }),
  markAsRead: (conversationId: string) =>
    api.post(`/messages/conversation/${conversationId}/read`),
  deleteMessage: (messageId: string) =>
    api.delete(`/messages/${messageId}`),
};

export const notificationApi = {
  registerToken: (token: string, deviceName: string) =>
    api.post('/notifications/register-token', { token, deviceName }),
  removeToken: (token: string) =>
    api.post('/notifications/remove-token', { token }),
};

export default api;
