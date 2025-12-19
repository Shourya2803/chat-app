'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useChatStore } from '@/store/chatStore';
import { requestForToken, onMessageListener } from '@/lib/firebaseClient';
import ChatWindow from './ChatWindow';

const toast = {
  success: (msg: string) => console.log('✓', msg),
  error: (msg: string) => console.error('✗', msg),
};

export default function ChatLayout() {
  const { user } = useUser();
  const { setActiveConversation } = useChatStore();

  useEffect(() => {
    if (!user) return;

    const initializeApp = async () => {
      try {
        // 1. Sync user with database
        console.log('🔄 Syncing user session...');
        const syncRes = await fetch('/api/auth/sync', { method: 'POST' });
        if (!syncRes.ok) {
          throw new Error('Failed to synchronize user session');
        }
        console.log('✅ User session synchronized');

        // 2. Set active conversation to global-group
        setActiveConversation('global-group');

        // 3. Initialize FCM for push notifications
        requestForToken().then(async (fcmToken) => {
          if (fcmToken) {
            console.log('Got FCM token:', fcmToken);
          }
        });

        // 4. Listen for foreground messages
        onMessageListener().then((payload: any) => {
          toast.success(`New Message: ${payload?.notification?.title}`);
        });

        toast.success('Connected to chat - Real-time via Firebase');
      } catch (error: any) {
        console.error('Failed to initialize app:', error);
        toast.error(error?.message || 'Failed to initialize chat');
      }
    };

    initializeApp();
  }, [user, setActiveConversation]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto bg-white dark:bg-gray-900 shadow-2xl">
        <ChatWindow />
      </div>
    </div>
  );
}
