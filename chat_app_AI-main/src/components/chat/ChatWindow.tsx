'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { messageApi, authApi } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { Moon, Sun } from 'lucide-react';
import { db } from '@/lib/firebaseClient';
import { ref, onValue, query, orderByKey, limitToLast } from 'firebase/database';

export default function ChatWindow() {
  const { user } = useUser();
  const { messages, addMessage, setMessages, prependMessages } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentDbUserId, setCurrentDbUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupName, setGroupName] = useState('Corporate General Chat');
  const lastMessageTimestamp = useRef<number>(0);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const currentCount = messages['global-group']?.length || 0;
      const res = await messageApi.getMessages('global-group', 50, currentCount);

      if (res.data.success && res.data.data.messages.length > 0) {
        prependMessages('global-group', res.data.data.messages);
        // If we got less than requested, we reached the end
        if (res.data.data.messages.length < 50) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setLoading(true);
      try {
        // 1. Ensure user is synced and get DB profile
        console.log('🔄 Syncing user profile...');
        try {
          // First try to get profile
          let profileRes;
          try {
            profileRes = await authApi.getProfile();
          } catch (e: any) {
            console.log('🔄 Profile not found, attempting sync...');
            await authApi.syncUser();
            profileRes = await authApi.getProfile();
          }

          if (profileRes.data.success && profileRes.data.data) {
            setCurrentDbUserId(profileRes.data.data.id);
            const userRole = profileRes.data.data.role || 'USER';
            setIsAdmin(userRole === 'ADMIN');
            console.log('✅ User sync complete');
          } else {
            console.warn('Could not fetch DB profile after sync');
            setCurrentDbUserId(user.id);
          }
        } catch (e) {
          console.error('❌ Failed to sync/fetch profile:', e);
          setCurrentDbUserId(user.id);
        }

        // 2. FAST LOAD: Fetch recent messages (Redis cache hits here)
        console.log('📨 Fetching initial messages...');
        const fastRes = await messageApi.getMessages('global-group', 20, 0);

        if (fastRes.data.success && fastRes.data.data.messages) {
          const initialMessages = fastRes.data.data.messages;
          setMessages('global-group', initialMessages);

          if (fastRes.data.data.name) {
            setGroupName(fastRes.data.data.name);
          }

          // 3. BACKGROUND LOAD: Fetch deeper history silently
          const currentCount = initialMessages.length;
          if (currentCount > 0) {
            const remainingLimit = 100 - currentCount;
            if (remainingLimit > 0) {
              const historyRes = await messageApi.getMessages('global-group', remainingLimit, currentCount);
              if (historyRes.data.success && historyRes.data.data.messages.length > 0) {
                prependMessages('global-group', historyRes.data.data.messages);
                if (historyRes.data.data.messages.length < remainingLimit) {
                  setHasMore(false);
                }
              } else {
                setHasMore(false);
              }
            }
          } else {
            setHasMore(false);
          }
        }
      } catch (error) {
        console.error('Failed to load initial messages:', error);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Setup Firebase Realtime Database listener for instant updates
    // Only subscribe if db is initialized (i.e. we have config)
    if (db) {
      const messagesRef = ref(db, 'messages');
      const recentMessagesQuery = query(messagesRef, orderByKey(), limitToLast(50));

      const unsubscribe = onValue(recentMessagesQuery, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Process each message
        Object.entries(data).forEach(([timestamp, firebaseMessage]: [string, any]) => {
          const messageTimestamp = parseInt(timestamp);

          // Only process new messages (after initial load)
          if (messageTimestamp <= lastMessageTimestamp.current) {
            return;
          }

          lastMessageTimestamp.current = messageTimestamp;

          // Determine what content to show based on user role
          const isSender = firebaseMessage.sender_id === user.id;
          const displayContent = firebaseMessage.content;

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
            read_at: undefined,
            created_at: new Date(messageTimestamp).toISOString(),
            updated_at: new Date(messageTimestamp).toISOString(),
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
      });

      return () => {
        unsubscribe();
      };
    }
  }, [user, addMessage, setMessages]);

  const conversationMessages = messages['global-group'] || [];

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold shadow-lg">
                CG
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 bg-green-500 shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {groupName}
                </h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Secured Enterprise Channel • Real-time via Firebase
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.theme = isDark ? 'dark' : 'light';
              }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              title="Toggle Theme"
            >
              <Sun className="w-5 h-5 hidden dark:block" />
              <Moon className="w-5 h-5 block dark:hidden" />
            </button>

            {/* Profile & Logout */}
            <div className="border-l border-gray-200 dark:border-gray-700 pl-4 h-8 flex items-center">
              <UserButton
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-8 h-8 border-2 border-primary-500/20 hover:border-primary-500/40 transition-all'
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <MessageList
          messages={conversationMessages}
          loading={loading}
          currentUserId={currentDbUserId}
          currentUsername={user?.username || user?.firstName || null}
          isAdmin={isAdmin}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      </main>

      {/* Input */}
      <footer className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto">
          <MessageInput dbUserId={currentDbUserId} />
        </div>
      </footer>
    </div>
  );
}
