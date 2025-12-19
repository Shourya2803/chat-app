'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { requestForToken, onMessageListener } from '@/lib/firebaseClient';
import { UserButton } from '@clerk/nextjs';
import ChatWindow from './ChatWindow';
import NotificationBell from '../NotificationBell';

const toast = {
  success: (msg: string) => console.log('✓', msg),
  error: (msg: string) => console.error('✗', msg),
};

export default function ChatLayout() {
  const { user } = useUser();
  const api = useApiClient();
  const {
    addMessage,
    setActiveConversation,
    activeConversationId
  } = useChatStore();

  useEffect(() => {
    if (!user) return;

    const initializeApp = async () => {
      try {
        // Sync user with backend
        await api.post('/auth/sync');
        toast.success('Connected to chat server');

        // Set active conversation to global-group
        setActiveConversation('global-group');

        // Load initial messages from API
        try {
          const response = await api.get('/messages?limit=100');
          if (response.data.success && response.data.data.messages) {
            response.data.data.messages.forEach((msg: any) => {
              addMessage(msg);
            });
          }
        } catch (err) {
          console.error('Failed to load messages:', err);
        }

        // Initialize FCM for push notifications
        requestForToken().then(async (fcmToken) => {
          if (fcmToken) {
            console.log('Got FCM token:', fcmToken);
            try {
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

        // Setup Firebase Realtime Database listener
        const { db } = await import('@/lib/firebaseClient');
        const { ref, onChildAdded, query, orderByKey, limitToLast } = await import('firebase/database');

        const messagesRef = ref(db, 'messages');
        const recentMessagesQuery = query(messagesRef, orderByKey(), limitToLast(50));

        let isInitialLoad = true;
        const loadTimestamp = Date.now();

        const unsubscribe = onChildAdded(recentMessagesQuery, (snapshot) => {
          const firebaseMessage = snapshot.val();

          // Skip messages older than when we connected (avoid duplicates)
          if (isInitialLoad && firebaseMessage.timestamp < loadTimestamp - 60000) {
            return;
          }

          isInitialLoad = false;

          // Determine what content to show based on user role
          const currentUserId = user.id;
          const userRole = (user as any).publicMetadata?.role || 'USER';
          const isAdmin = userRole === 'ADMIN';
          const isSender = firebaseMessage.sender_id === currentUserId;

          const displayContent = isAdmin || isSender
            ? firebaseMessage.original_content
            : firebaseMessage.content;

          const message = {
            id: firebaseMessage.id,
            conversation_id: 'global-group',
            sender_id: firebaseMessage.sender_id,
            sender_username: firebaseMessage.sender_username,
            receiver_id: 'global-group',
            content: displayContent,
            original_content: firebaseMessage.original_content,
            message_type: firebaseMessage.media_url ? 'image' : 'text',
            media_url: firebaseMessage.media_url,
            status: 'sent',
            is_read: false,
            read_at: null,
            created_at: new Date(firebaseMessage.timestamp).toISOString(),
            updated_at: new Date(firebaseMessage.timestamp).toISOString(),
          };

          // Play sound for messages from others
          if (!isSender) {
            try {
              const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTtvT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT18=");
              audio.volume = 0.4;
              audio.play().catch(() => { });
            } catch (e) { }
          }

          addMessage(message);
        });

        return () => {
          unsubscribe();
        };
      } catch (error: any) {
        console.error('Failed to initialize app:', error);
        toast.error(error?.response?.data?.error || error?.message || 'Failed to connect to chat server');
      }
    };

    initializeApp();
  }, [user, api, setActiveConversation, addMessage]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto bg-white dark:bg-gray-900 shadow-2xl">
        <ChatWindow />
      </div>
    </div>
  );
}
