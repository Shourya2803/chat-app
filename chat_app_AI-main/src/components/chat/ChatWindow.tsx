'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useChatStore } from '@/store/chatStore';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { Moon, Sun, Menu, MessageSquare, Users, ArrowLeft, Settings2 } from 'lucide-react';
import { firestore, db as rtdb } from '@/lib/firebaseClient';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import GroupSettingsModal from './GroupSettingsModal';

export default function ChatWindow() {
  const { user } = useUser();
  const { messages, setMessages, activeConversationId, setActiveConversation } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [currentDbUserId, setCurrentDbUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const syncUser = async () => {
      try {
        const res = await fetch('/api/users/me');
        const data = await res.json();
        if (data.success) {
          setCurrentDbUserId(data.data.id);
          setIsAdmin(data.data.role === 'ADMIN');
        }

        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        if (usersData.success) {
          setAllUsers(usersData.data);
        }
      } catch (e) {
        setCurrentDbUserId(user.id);
      }
    };
    syncUser();
  }, [user]);

  useEffect(() => {
    if (!activeConversationId || !rtdb) return;

    setLoading(true);

    const fetchChatInfo = async () => {
      if (!firestore) return;
      const chatDoc = await getDoc(doc(firestore, 'chats', activeConversationId));
      if (chatDoc.exists()) {
        setChatInfo(chatDoc.data());
      }
    };
    fetchChatInfo();

    // ⚡ REALTIME DATABASE: Instant Sub-second Sync
    const messagesRef = ref(rtdb, `messages/${activeConversationId}`);

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages(activeConversationId, []);
        setLoading(false);
        return;
      }

      // Convert RTDB Object to Sorted Array
      const newMessages = Object.entries(data).map(([id, msg]: [string, any]) => {
        const isSender = msg.senderId === user?.id;

        // Sender/Admin see original content
        // Others ONLY see aiText (The professional secured version)
        const displayContent = (isAdmin || isSender)
          ? (msg.originalText || msg.aiText)
          : (msg.aiText || msg.originalText);

        return {
          id: id,
          conversation_id: activeConversationId,
          sender_id: msg.senderId,
          sender_username: msg.senderUsername,
          receiver_id: activeConversationId,
          content: displayContent,
          original_content: msg.originalText || '',
          ai_content: msg.aiText || '',
          message_type: msg.mediaUrl ? 'image' : 'text',
          media_url: msg.mediaUrl,
          status: 'sent',
          is_read: true,
          created_at: msg.createdAt || new Date().toISOString(),
          updated_at: msg.createdAt || new Date().toISOString(),
        };
      }).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setMessages(activeConversationId, newMessages);
      setLoading(false);

      // Verification log for testing
      if (newMessages.length > 0) {
        const lastMsg = newMessages[newMessages.length - 1];
        console.log(`💬 Message Sync: Last message original: "${lastMsg.original_content}" | Secured: "${lastMsg.ai_content}"`);
      }
    }, (error) => {
      console.error('⚠️ Realtime Sync Failed:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeConversationId, user?.id, isAdmin]);

  const conversationMessages = activeConversationId ? (messages[activeConversationId] || []) : [];

  const getChatName = () => {
    if (!chatInfo) return 'Loading...';
    if (chatInfo.type === 'group') return chatInfo.name || 'Group Chat';

    const otherMemberId = chatInfo.members?.find((id: string) => id !== user?.id);
    if (!otherMemberId) return 'Direct Chat';

    const otherUser = allUsers.find(u => u.clerkId === otherMemberId || u.id === otherMemberId);
    return otherUser ? (otherUser.username || otherUser.firstName || 'User') : 'Direct Chat';
  };

  if (!activeConversationId) {
    return (
      <div className="hidden md:flex flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-500">
        <div className="p-6 rounded-full bg-gray-100 dark:bg-gray-800 mb-4 animate-bounce">
          <MessageSquare className="w-12 h-12 text-primary-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Select a conversation</h2>
        <p className="max-w-xs text-center">Choose a chat from the sidebar or create a new group to start messaging.</p>
      </div>
    );
  }

  const isMember = chatInfo?.members?.includes(user?.id);
  const isGroup = chatInfo?.type === 'group';

  const handleJoin = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/chats/join-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeConversationId }),
      });
      const data = await res.json();
      if (data.success) {
        setChatInfo(data.data);
        // Snapshot will auto-refresh messages if it's listening
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error("Join failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 h-screen overflow-hidden ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setActiveConversation(null)}
              className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold shadow-lg uppercase">
                {getChatName()[0]}
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 bg-green-500 shadow-sm" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                {getChatName()}
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                {isGroup ? `Group • ${chatInfo?.members?.length || 0}` : 'Direct Channel'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.theme = isDark ? 'dark' : 'light';
              }}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all"
            >
              <Sun className="w-5 h-5 hidden dark:block" />
              <Moon className="w-5 h-5 block dark:hidden" />
            </button>

            {isGroup && isAdmin && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all"
                title="Group Settings"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            )}

            <div className="border-l border-gray-200 dark:border-gray-700 pl-4 h-8 flex items-center">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {isGroup && !isMember && !isAdmin ? (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="p-5 rounded-3xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-6 shadow-inner">
              <Users className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">Join {getChatName()}</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed font-medium">
              You aren't a member of this global group yet. Join now to participate in the conversation.
            </p>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="px-12 py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Joining group...' : 'Join Global Group'}
            </button>
          </div>
        ) : null}

        <MessageList
          messages={conversationMessages}
          loading={loading}
          currentUserId={user?.id || ''}
          currentUsername={user?.username || user?.firstName || null}
          isAdmin={isAdmin}
          onLoadMore={() => { }}
          hasMore={false}
          loadingMore={false}
        />

        {isSettingsOpen && activeConversationId && (
          <GroupSettingsModal
            chatId={activeConversationId}
            currentName={getChatName()}
            onCloseAction={() => {
              setIsSettingsOpen(false);
              // Refresh chat info to reflect name change if needed
              const fetchChatInfo = async () => {
                if (!firestore) return;
                const chatDoc = await getDoc(doc(firestore, 'chats', activeConversationId));
                if (chatDoc.exists()) {
                  setChatInfo(chatDoc.data());
                }
              };
              fetchChatInfo();
            }}
          />
        )}
      </main>

      <footer className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <MessageInput dbUserId={currentDbUserId} />
        </div>
      </footer>
    </div>
  );
}
