'use client';

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useUIStore } from '@/store/uiStore';
import { socketService } from '@/lib/socket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { Sparkles, Moon, Sun, Edit3, Check, X } from 'lucide-react';

export default function ChatWindow() {
  const { user } = useUser();
  const api = useApiClient();
  const { messages, setMessages, typingUsers } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [currentDbUserId, setCurrentDbUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupName, setGroupName] = useState('Corporate General Chat');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // Get typing users for active conversation
  const typingInConversation = typingUsers['global-group'] || [];
  const isOtherUserTyping = typingInConversation.some(
    (userId) => userId !== currentDbUserId
  );

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [meRes, msgRes] = await Promise.all([
          api.get('/users/me'),
          api.get('/messages/conversation/global-group?limit=100&offset=0')
        ]);

        // Handle User Data
        setCurrentDbUserId(meRes.data.user.id);
        const userRole = meRes.data.user.role;
        setIsAdmin(userRole === 'ADMIN');

        // Handle Messages
        setMessages('global-group', msgRes.data.data.messages);
        if (msgRes.data.data.name) {
          setGroupName(msgRes.data.data.name);
        }
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
    socketService.joinConversation('global-group');

    // "ISR-like" Polling Fallback (Every 10 seconds)
    // Ensures real-time reliability if Socket.IO drops on Vercel
    const pollInterval = setInterval(() => {
      loadMessages();
    }, 10000);

    return () => {
      socketService.leaveConversation('global-group');
      clearInterval(pollInterval);
    };
  }, [user, api]);

  const loadMessages = async () => {
    // This can still be used for manual refreshes
    try {
      const response = await api.get(
        `/messages/conversation/global-group?limit=100&offset=0`
      );
      setMessages('global-group', response.data.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    try {
      await api.patch('/messages/conversation/global-group/name', { name: newName });
      setGroupName(newName);
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update group name:', error);
    }
  };

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
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-gray-100 dark:bg-gray-700 border-none rounded px-2 py-1 text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                      autoFocus
                    />
                    <button onClick={handleUpdateName} className="text-green-500 hover:text-green-600">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                      {groupName}
                    </h2>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setNewName(groupName);
                          setIsEditingName(true);
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-primary-500"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {isOtherUserTyping ? (
                  <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                    <span className="animate-pulse">Someone is typing...</span>
                  </span>
                ) : (
                  'Secured Enterprise Channel'
                )}
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
          isAdmin={isAdmin}
        />
      </main>

      {/* Input */}
      <footer className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto">
          <MessageInput />
        </div>
      </footer>
    </div>
  );
}
