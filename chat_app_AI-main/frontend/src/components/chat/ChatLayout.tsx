'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api';
import socketService from '@/lib/socket';
import { useChatStore } from '@/store/chatStore';
import { requestForToken, onMessageListener } from '@/lib/firebaseClient';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import NotificationBell from '../NotificationBell';

const toast = {
  success: (msg: string) => console.log('✓', msg),
  error: (msg: string) => console.error('✗', msg),
};

export default function ChatLayout() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const api = useApiClient();
  const {
    setUserOnline,
    setUserOffline,
    addMessage,
    incrementUnread,
    activeConversationId
  } = useChatStore();

  useEffect(() => {
    if (!user) return;

    const initializeApp = async () => {
      try {
        // Sync user with backend
        await api.post('/auth/sync');
        toast.success('Connected to chat server');

        // Disable Socket.IO on Vercel/serverless environments
        // By default we avoid opening persistent Socket connections from Vercel builds
        // because serverless platforms can cause connection limits. If you want to
        // enable real-time features from the browser on Vercel, set
        // `NEXT_PUBLIC_ENABLE_SOCKETS=true` in Vercel Project → Environment Variables.
        const isServerless = typeof window !== 'undefined' && (
          process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined ||
          window.location.hostname.includes('vercel.app')
        ) && process.env.NEXT_PUBLIC_ENABLE_SOCKETS !== 'true';

        if (isServerless) {
          console.warn('⚠️ Real-time features disabled on Vercel. Deploy on Railway/Render for WebSocket support.');
          return;
        }

        // Connect to Socket.IO only on platforms with custom server support
        const token = await getToken();
        if (token) {
          // Initialize FCM and register token
          requestForToken().then(async (fcmToken) => {
            if (fcmToken) {
              console.log('Got FCM token:', fcmToken);
              try {
                // Register token with backend
                await api.post('/notifications/register-token', {
                  token: fcmToken,
                  deviceName: navigator.userAgent || 'Web Browser'
                });
                console.log('FCM token registered with backend');
              } catch (err) {
                console.error('Failed to register FCM token with backend:', err);
              }
            }
          });

          // Listen for foreground messages
          onMessageListener().then((payload: any) => {
            toast.success(`New Message: ${payload?.notification?.title}`);
          });

          const socket = socketService.connect(token);

          // Listen for new messages
          socket.on('new-message', (message) => {
            addMessage(message);

            // Increment unread if not in active conversation
            if (message.conversation_id !== activeConversationId) {
              incrementUnread(message.conversation_id);
              toast.success('New message received');
            }
          });

          // Listen for message sent confirmation
          socket.on('message-sent', (message) => {
            addMessage(message);
          });

          // Listen for message errors
          socket.on('message-error', (error) => {
            toast.error(error.error || 'Failed to send message');
          });

          // Listen for user status changes
          socket.on('user-status', ({ userId, status }) => {
            if (status === 'online') {
              setUserOnline(userId);
            } else {
              setUserOffline(userId);
            }
          });

          // Listen for typing indicators
          socket.on('user:typing', ({ userId, conversationId, username, isTyping }) => {
            useChatStore.getState().setTyping(conversationId, userId, isTyping);
          });

          // Send heartbeat every 4 minutes
          const heartbeatInterval = setInterval(() => {
            socket.emit('heartbeat');
          }, 240000);

          // Refresh token and reconnect every 10 minutes to prevent expiration
          const tokenRefreshInterval = setInterval(async () => {
            try {
              const newToken = await getToken();
              if (newToken) {
                console.log('🔄 Refreshing Socket.IO connection with new token...');
                socketService.disconnect();
                socketService.connect(newToken);
              }
            } catch (error) {
              console.error('Token refresh failed:', error);
            }
          }, 600000); // 10 minutes

          return () => {
            clearInterval(heartbeatInterval);
            clearInterval(tokenRefreshInterval);
            socketService.disconnect();
          };
        }
      } catch (error: any) {
        console.error('Failed to initialize app:', error);
        const status = error?.response?.status;
        const errorMsg = error?.response?.data?.error || error?.message || 'Failed to connect to chat server';

        if (status === 404) {
          console.error('Received 404 from /api/auth/sync. This usually means the frontend is proxying to the wrong backend or the backend routes are not available.');
          console.error('If your backend is deployed (Render), set `NEXT_PUBLIC_API_URL` or `BACKEND_URL` in frontend/.env.local to the backend base URL (https://...).');
        }

        toast.error(errorMsg);
      }
    };

    initializeApp();
  }, [user, getToken, api]);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Top Bar with Notification Bell */}
        <div className="flex items-center justify-end p-4 border-b border-gray-200 dark:border-gray-700">
          <NotificationBell />
        </div>
        <ChatWindow />
      </div>
    </div>
  );
}
