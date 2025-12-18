'use client';

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useApiClient } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useUIStore } from '@/store/uiStore';
import { Search, MessageSquare, Moon, Sun, Menu } from 'lucide-react';
import { format } from 'date-fns';

const toast = { error: (msg: string) => console.error('Error:', msg) };

export default function Sidebar() {
  const { user } = useUser();
  const api = useApiClient();
  const { conversations, setConversations, setActiveConversation, activeConversationId, unreadCounts } = useChatStore();
  const { theme, toggleTheme, sidebarOpen, toggleSidebar, setTheme } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Hydrate Zustand store from localStorage
    useUIStore.persist.rehydrate();

    // Apply theme from localStorage on mount
    const savedTheme = localStorage.getItem('ui-storage');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        if (parsed.state?.theme) {
          setTheme(parsed.state.theme);
        }
      } catch (e) {
        console.error('Failed to parse theme:', e);
      }
    }

    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await api.get('/users/conversations');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      const status = (error as any)?.response?.status;
      if (status === 404) {
        console.warn('Primary /users/conversations returned 404; attempting fallback /users/conversations/list');
        try {
          const fallback = await api.get('/users/conversations/list');
          setConversations(fallback.data.conversations || []);
          return;
        } catch (fallbackErr) {
          console.error('Fallback /users/conversations/list also failed:', fallbackErr);
        }

        console.error('Received 404 when fetching /users/conversations. This means the frontend proxy forwarded to a backend that does not expose this route.');
        console.error('Check that your backend is running and that `NEXT_PUBLIC_API_URL`/`BACKEND_URL` points to the correct server. Current values:', {
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
          BACKEND_URL: process.env.BACKEND_URL,
        });
        toast.error('Conversations route not found on backend (404). Start the backend or set NEXT_PUBLIC_API_URL to the running backend.');
      } else {
        toast.error('Failed to load conversations');
      }
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.get(`/users?q=${query}`);
      // Support both `{ users }` and `{ data: { users } }` response shapes
      const users = response.data.users || response.data.data?.users || [];
      setSearchResults(users);
    } catch (error) {
      console.error('Search failed:', error);
      const status = (error as any)?.response?.status;
      if (status === 404) {
        console.error('Search API returned 404. Ensure backend implements `/users` and that NEXT_PUBLIC_API_URL points to the correct backend.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const startConversation = async (otherUser: any) => {
    try {
      const response = await api.post('/messages/conversation', { userId: otherUser.id });
      const conversationId = response.data.data.conversationId;
      setActiveConversation(conversationId);
      setSearchQuery('');
      setSearchResults([]);
      await loadConversations();
    } catch (error) {
      console.error('Failed to create conversation:', error);
      const status = (error as any)?.response?.status;
      if (status === 404) {
        toast.error('Conversation API not found on backend (404). Check backend and NEXT_PUBLIC_API_URL.');
      } else {
        toast.error('Failed to start conversation');
      }
    }
  };

  return (
    <div
      className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        {/* User Status Bar */}
        <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 dark:bg-gray-750 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {user?.username || user?.firstName || 'User'} • Online
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            Active now
          </span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            AI Chat
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Search Results or Conversations */}
      <div className="flex-1 overflow-y-auto">

        {searchQuery && searchResults.length > 0 ? (
          <div key="search-results">
            {searchResults.map((user) => (
              <div
                key={user.id}
                onClick={() => startConversation(user)}
                className="p-4 cursor-pointer border-b border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                    {user.username?.[0] || user.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {user.username || `${user.firstName} ${user.lastName}`}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 capitalize">{user.status || 'offline'}</span>
                    <div className={`w-3 h-3 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div key="conversations">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm mt-2">Search for users to start chatting</p>
              </div>
            ) : (
              conversations.map((conv) => {
                if (!conv.other_user) return null;

                return (
                  <div
                    key={conv.conversation_id}
                    onClick={() => setActiveConversation(conv.conversation_id)}
                    className={`p-4 cursor-pointer border-b border-gray-200 dark:border-gray-700 ${activeConversationId === conv.conversation_id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                          {conv.other_user.username?.[0] || (conv.other_user.email && conv.other_user.email[0]?.toUpperCase()) || '?'}
                        </div>
                        <div
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${conv.other_user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {conv.other_user.username || `${conv.other_user.first_name || ''} ${conv.other_user.last_name || ''}`}
                            </p>
                            {conv.other_user.status === 'online' && (
                              <span className="text-xs text-green-600 dark:text-green-400">●</span>
                            )}
                            {unreadCounts[conv.conversation_id] > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-green-500 rounded-full">
                                {unreadCounts[conv.conversation_id] > 99 ? '99+' : unreadCounts[conv.conversation_id]}
                              </span>
                            )}
                          </div>
                          {conv.last_message && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(conv.last_message.created_at), 'HH:mm')}
                            </span>
                          )}
                        </div>
                        {conv.last_message && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {conv.last_message.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })

            )}
          </div>
        )}

      </div>
    </div>
  );
}

