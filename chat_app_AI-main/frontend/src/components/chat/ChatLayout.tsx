'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api';
import socketService from '@/lib/socket';
import { useChatStore } from '@/store/chatStore';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';

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
        const isServerless = typeof window !== 'undefined' && (
          process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined ||
          window.location.hostname.includes('vercel.app')
        );
        
        if (isServerless) {
          console.warn('⚠️ Real-time features disabled on Vercel. Deploy on Railway/Render for WebSocket support.');
          return;
        }

        // Connect to Socket.IO only on platforms with custom server support
        const token = await getToken();
        if (token) {
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

          // Send heartbeat every 4 minutes
          const heartbeatInterval = setInterval(() => {
            socket.emit('heartbeat');
          }, 240000);

          return () => {
            clearInterval(heartbeatInterval);
            socketService.disconnect();
          };
        }
      } catch (error: any) {
        console.error('Failed to initialize app:', error);
        const errorMsg = error?.response?.data?.error || error?.message || 'Failed to connect to chat server';
        toast.error(errorMsg);
      }
    };

    initializeApp();
  }, [user, getToken, api]);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar />
      <ChatWindow />
    </div>
  );
}
