'use client';

import { useState, useEffect } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { firestore } from '@/lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy, doc, setDoc } from 'firebase/firestore';
import { useChatStore } from '@/store/chatStore';
import { Users, User, Plus, Shield } from 'lucide-react';
import CreateGroupModal from '@/components/chat/CreateGroupModal';
import JoinGroupModal from '@/components/chat/JoinGroupModal';

export default function Sidebar() {
  const { user } = useUser();
  const { activeConversationId, setActiveConversation } = useChatStore();
  const [chats, setChats] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user || !firestore) return;

    // Log project ID for environment verification
    console.log('🔥 Firestore Client initialized for Project:', (firestore as any)._databaseId?.projectId || 'unknown');

    const fetchData = async () => {
      // Fetch current user info
      const meRes = await fetch('/api/users/me');
      const meData = await meRes.json();
      if (meData.success) {
        setIsAdmin(meData.data?.role === 'ADMIN');
      }

      // Fetch all users for name mapping
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      if (usersData.success) {
        setAllUsers(usersData.data);
      }
    };
    fetchData();

    const setupListeners = () => {
      if (!firestore) return () => { };

      let groupChats: any[] = [];
      let directChats: any[] = [];

      const updateChats = () => {
        const combined = [...groupChats, ...directChats].sort((a, b) => {
          const timeA = a.lastMessageAt?.toDate?.()?.getTime() || 0;
          const timeB = b.lastMessageAt?.toDate?.()?.getTime() || 0;
          return timeB - timeA;
        });
        setChats(combined);
      };

      // Listener A: All group chats (Public Visibility)
      const qGroups = query(
        collection(firestore as any, 'chats'),
        where('type', '==', 'group')
      );
      const unsubGroups = onSnapshot(qGroups, (snapshot) => {
        groupChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateChats();
      }, (err) => console.error("Global groups listener failed:", err));

      // Listener B: Private direct chats
      const qDirect = query(
        collection(firestore as any, 'chats'),
        where('type', '==', 'direct'),
        where('members', 'array-contains', user.id)
      );
      const unsubDirect = onSnapshot(qDirect, (snapshot) => {
        directChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateChats();
      }, (err) => console.error("Private chats listener failed:", err));

      return () => {
        unsubGroups();
        unsubDirect();
      };
    };

    const unsubscribe = setupListeners();

    return () => unsubscribe();
  }, [user]);

  const getChatName = (chat: any) => {
    if (chat.type === 'group') return chat.name || 'Untitled Group';

    // For direct chats, find the other member
    const otherMemberId = chat.members?.find((id: string) => id !== user?.id);
    if (!otherMemberId) return 'Direct Chat';

    const otherUser = allUsers.find(u => u.clerkId === otherMemberId || u.id === otherMemberId);
    return otherUser ? (otherUser.username || otherUser.firstName || 'User') : 'Direct Chat';
  };

  return (
    <div className={`w-full md:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h1 className="font-bold text-lg dark:text-gray-100">Messages</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => window.location.href = '/admin'}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              title="Admin Settings"
            >
              <Shield className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all shadow-sm"
            title="Join Group"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="p-1.5 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-all shadow-sm"
            title="Create Group"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="ml-2 border-l border-gray-200 dark:border-gray-700 pl-2">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No conversations yet.
          </div>
        ) : (
          chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setActiveConversation(chat.id)}
              className={`p-4 cursor-pointer border-b border-gray-100 dark:border-gray-800/50 transition-colors ${activeConversationId === chat.id
                ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-600'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                }`}
            >
              <div className="flex items-center gap-3">
                {chat.type === 'group' ? (
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Users className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {getChatName(chat)}
                    </h3>
                    {chat.type === 'group' && (
                      <div className="flex gap-1.5">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${(chat.members?.includes(user?.id) || isAdmin)
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                          }`}>
                          {(chat.members?.includes(user?.id) || isAdmin) ? 'Joined' : 'Open'}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {(isAdmin ? (chat.lastOriginalMessage || chat.lastMessage) : chat.lastMessage) || 'Start a conversation'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isCreateModalOpen && (
        <CreateGroupModal onCloseAction={() => setIsCreateModalOpen(false)} />
      )}

      {isJoinModalOpen && (
        <JoinGroupModal onCloseAction={() => setIsJoinModalOpen(false)} />
      )}
    </div>
  );
}
