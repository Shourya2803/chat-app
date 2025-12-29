'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useChatStore } from '@/store/chatStore';
import { requestForToken, onMessageListener } from '@/lib/firebaseClient';
import ChatWindow from './ChatWindow';
import Sidebar from './Sidebar';
import { Toaster, toast } from 'sonner';

export default function ChatLayout() {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    const initializeApp = async () => {
      try {
        console.log('🔄 Syncing user session...');
        const syncRes = await fetch('/api/auth/sync', { method: 'POST' }).catch(err => {
          if (err.message === 'Failed to fetch') {
            throw new Error('ADBLOCKED');
          }
          throw err;
        });

        if (!syncRes.ok) throw new Error('Failed to synchronize user session');

        requestForToken().then(async (fcmToken) => {
          if (fcmToken) console.log('Got FCM token:', fcmToken);
        }).catch(err => {
          if (err.message?.includes('blocked')) {
            console.warn('FCM blocked by client');
          }
        });

        onMessageListener().then((payload: any) => {
          toast.success(`New Message: ${payload?.notification?.title}`);
        }).catch(() => { });

      } catch (error: any) {
        if (error.message === 'ADBLOCKED') {
          toast.error('Connection Blocked', {
            description: 'Your adblocker may be interfering with the chat. Please disable it for this site.',
            duration: 10000,
          });
        } else {
          console.error('Failed to initialize app:', error);
          toast.error(error?.message || 'Failed to initialize chat');
        }
      }
    };

    initializeApp();
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 font-sans">
      <div className="flex w-full h-full bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <Sidebar />
        <ChatWindow />
      </div>
    </div>
  );
}
