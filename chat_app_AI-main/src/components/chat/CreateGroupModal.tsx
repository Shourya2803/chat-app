'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { firestore } from '@/lib/firebaseClient';
import { collection } from 'firebase/firestore';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useChatStore } from '@/store/chatStore';

interface Props {
    onCloseAction: () => void;
}

export default function CreateGroupModal({ onCloseAction }: Props) {
    const { user } = useUser();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user) return;

        setLoading(true);
        try {
            const res = await fetch('/api/chats/create-group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() }),
            });

            const data = await res.json();
            if (data.success && data.data) {
                toast.success('Group created successfully!');
                const { setActiveConversation } = useChatStore.getState();
                setActiveConversation(data.data.id);
                onCloseAction();
            } else {
                toast.error(data.error || 'Failed to create group');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            toast.error('Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create New Group</h2>
                    <button onClick={onCloseAction} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 px-1">
                            Group Name
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Project Apollo, Marketing Team"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-all"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Creating...' : 'Create Group'}
                    </button>

                    <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                        You'll be added as the first member automatically.
                    </p>
                </form>
            </div>
        </div>
    );
}
