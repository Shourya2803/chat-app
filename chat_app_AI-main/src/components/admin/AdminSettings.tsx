'use client';

import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AdminSettings() {
    const [systemPrompt, setSystemPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // Load existing rules on mount via API
    useEffect(() => {
        const loadRules = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                const data = await res.json();
                if (data.success && data.data) {
                    setSystemPrompt(data.data.systemPrompt || "");
                }
            } catch (error) {
                console.error("Failed to load rules:", error);
                toast.error("Failed to load existing rules");
            } finally {
                setFetching(false);
            }
        };
        loadRules();
    }, []);

    const saveRules = async () => {
        if (!systemPrompt.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success("AI rules saved successfully!");
            } else {
                throw new Error(data.error || "Failed to save");
            }
        } catch (error: any) {
            console.error("Failed to save:", error);
            toast.error(error.message || "Failed to save rules");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 text-gray-900 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">AI Rules Settings</h1>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase">Admin Console</span>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest">
                            System Prompt (AI Persona)
                        </label>
                        <p className="text-sm text-gray-500 mb-4">
                            These instructions guide the AI on how to convert message tones.
                            Users will see the "AI Secured" version based on these rules.
                        </p>
                    </div>

                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Example: 'You are a professional assistant. Convert every message to a formal business tone. Remove slang and profanity.'"
                        className="w-full h-80 p-6 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-sm leading-relaxed bg-gray-50/30"
                    />

                    <div className="mt-8 flex items-center gap-4">
                        <button
                            onClick={saveRules}
                            disabled={loading || !systemPrompt.trim()}
                            className="px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                        >
                            {loading ? "Saving Changes..." : "Apply Rules"}
                        </button>
                        {loading && <span className="text-sm text-gray-400 animate-pulse">Syncing with Firestore...</span>}
                    </div>
                </div>

                <div className="mt-8 p-6 bg-yellow-50 border border-yellow-100 rounded-2xl">
                    <p className="text-xs text-yellow-800 leading-relaxed">
                        <strong>Note:</strong> Changes take effect immediately for all new messages.
                        Past messages in the conversation history will maintain their original AI-converted text.
                    </p>
                </div>
            </div>
        </div>
    );
}
