'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    onCloseAction: () => void;
}

export default function JoinGroupModal({ onCloseAction }: Props) {
    const { user } = useUser();
    const [chatId, setChatId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatId.trim() || !user) return;

        setLoading(true);
        try {
            const res = await fetch('/api/chats/join-group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: chatId.trim() }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Joined group successfully!');
                onCloseAction();
            } else {
                toast.error(data.error || 'Failed to join group');
            }
        } catch (error) {
            console.error('Error joining group:', error);
            toast.error('Failed to join group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Join a Group</h2>
                    <button onClick={onCloseAction} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleJoin} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 px-1">
                            Group/Chat ID
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            placeholder="Enter the ID of the group"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-all"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !chatId.trim()}
                        className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Joining...' : 'Join Group'}
                    </button>

                    <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                        Ask the group creator for the Chat ID.
                    </p>
                </form>
            </div>
        </div>
    );
}
