'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { X, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useChatStore } from '@/store/chatStore';

interface Props {
    chatId: string;
    currentName: string;
    onCloseAction: () => void;
}

export default function GroupSettingsModal({ chatId, currentName, onCloseAction }: Props) {
    const { user } = useUser();
    const [name, setName] = useState(currentName);
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user || name.trim() === currentName) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/chats/${chatId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Group renamed effectively');
                // The ChatWindow will eventually re-fetch or the sidebar will sync
                onCloseAction();
            } else {
                toast.error(data.error || 'Failed to rename group');
            }
        } catch (error) {
            console.error('Error renaming group:', error);
            toast.error('Failed to rename group');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGroup = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/chats/${chatId}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (data.success) {
                toast.success('Group deleted successfully');
                const { setActiveConversation } = useChatStore.getState();
                setActiveConversation(null);
                onCloseAction();
            } else {
                toast.error(data.error || 'Failed to delete group');
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            toast.error('Failed to delete group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-gray-100 dark:border-gray-800">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                            <Edit3 className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Group Settings</h2>
                    </div>
                    <button onClick={onCloseAction} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Rename Section */}
                    <form onSubmit={handleUpdateName} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 px-1">
                                Rename Group
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter new group name"
                                    className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !name.trim() || name.trim() === currentName}
                            className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading && !showDeleteConfirm ? 'Updating...' : 'Save Changes'}
                        </button>
                    </form>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    {/* Delete Section */}
                    {!showDeleteConfirm ? (
                        <div className="space-y-3">
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 px-1">
                                Danger Zone
                            </label>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full py-3.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-2xl transition-all border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-5 h-5" />
                                Delete Group
                            </button>
                            <p className="text-[11px] text-center text-gray-500 dark:text-gray-400">
                                This action will permanently remove all messages and group data.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-3xl p-5 space-y-4 animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-6 h-6 shrink-0" />
                                <h3 className="font-bold">Are you absolutely sure?</h3>
                            </div>
                            <p className="text-sm text-red-700/80 dark:text-red-300/80 leading-relaxed font-medium">
                                This will permanently delete the <strong>"{currentName}"</strong> group and all its history. There is no undo.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 py-3 px-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteGroup}
                                    disabled={loading}
                                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Deleting...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
