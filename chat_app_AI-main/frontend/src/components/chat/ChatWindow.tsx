'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useUIStore } from '@/store/uiStore';
import socketService from '@/lib/socket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ToneSelector from './ToneSelector';
import { MessageSquare, Sparkles } from 'lucide-react';

export default function ChatWindow() {
  const { user } = useUser();
  const api = useApiClient();
  const { activeConversationId, conversations, messages, setMessages, resetUnread } = useChatStore();
  const { toneEnabled, toggleTone } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [currentDbUserId, setCurrentDbUserId] = useState<string>('');

  const activeConversation = conversations.find(
    (c) => c.conversation_id === activeConversationId
  );

  // Get database user ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/users/me');
        setCurrentDbUserId(response.data.user.id);
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };
    
    if (user) {
      fetchCurrentUser();
    }
  }, [user]);

  useEffect(() => {
    if (!activeConversationId) return;

    loadMessages();
    socketService.joinConversation(activeConversationId);
    
    // Mark as read
    markConversationAsRead();

    return () => {
      socketService.leaveConversation(activeConversationId);
    };
  }, [activeConversationId]);

  const loadMessages = async () => {
    if (!activeConversationId) return;

    setLoading(true);
    try {
      const response = await api.get(
        `/messages/conversation/${activeConversationId}?limit=50&offset=0`
      );
      setMessages(activeConversationId, response.data.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markConversationAsRead = async () => {
    if (!activeConversationId) return;

    try {
      await api.post(`/messages/conversation/${activeConversationId}/read`);
      resetUnread(activeConversationId);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <MessageSquare className="w-24 h-24 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Welcome to AI Chat
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Select a conversation or search for users to start chatting
          </p>
        </div>
      </div>
    );
  }

  const conversationMessages = messages[activeConversationId] || [];

  return (
    <div
      className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 min-h-screen"
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                {activeConversation?.other_user.username?.[0] || activeConversation?.other_user.email[0].toUpperCase()}
              </div>
              <div
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                  activeConversation?.other_user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {activeConversation?.other_user.username ||
                  `${activeConversation?.other_user.first_name} ${activeConversation?.other_user.last_name}`}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeConversation?.other_user.status || 'offline'}
              </p>
            </div>
          </div>

          {/* Tone Toggle */}
          <button
            onClick={toggleTone}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              toneEnabled
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">AI Tone</span>
          </button>
        </div>

        {/* Tone Selector */}
        {toneEnabled && <ToneSelector />}
      </div>

      {/* Messages */}
      <MessageList 
        messages={conversationMessages} 
        loading={loading}
        currentUserId={currentDbUserId}
      />

      {/* Input */}
      <MessageInput 
        conversationId={activeConversationId}
        receiverId={activeConversation?.other_user.id || ''}
      />
    </div>
  );
}

