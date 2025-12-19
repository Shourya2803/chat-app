'use client';

// (Check imports - lines 3-6 seem sufficient, no new external deps used besides simple HTML)
// Actually, no new imports needed. loadingMore logic uses basic HTML/CSS.
import { useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Check, CheckCheck, Image as ImageIcon, Sparkles } from 'lucide-react';
import type { Message } from '@/store/chatStore';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  currentUserId: string;
  currentUsername?: string | null;
  isAdmin?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export default function MessageList({ messages, loading, currentUserId, currentUsername, isAdmin, onLoadMore, hasMore, loadingMore }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  useEffect(() => {
    // 1. Loading More (Pagination) - Do NOT auto-scroll, maintain position
    if (loadingMore) return;

    // 2. New Messages / Initial Load
    const isNewMessage = messages.length - prevMessagesLength.current === 1;
    const isBulkLoad = messages.length - prevMessagesLength.current > 1;

    // 3. Execute Scroll
    if (isBulkLoad || messages.length === 0) {
      // Force instant scroll to bottom for bulk loads (initial or background fetch)
      // using scrollIntoView on an anchor element is more reliable than scrollTop calculations
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    } else if (isNewMessage) {
      // Smooth scroll for single new messages
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    prevMessagesLength.current = messages.length;
  }, [messages, loadingMore]);

  const formatMessageTime = (date: string) => {
    if (!date) return '';
    const messageDate = new Date(date);
    if (isNaN(messageDate.getTime())) return '';

    try {
      if (isToday(messageDate)) {
        return format(messageDate, 'HH:mm');
      } else if (isYesterday(messageDate)) {
        return `Yesterday ${format(messageDate, 'HH:mm')}`;
      } else {
        return format(messageDate, 'MMM dd, HH:mm');
      }
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide bg-[#f8fafc] dark:bg-[#0f172a]">
        <div className="max-w-4xl mx-auto space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex items-start gap-3 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className={`flex flex-col max-w-[70%] ${i % 2 === 0 ? 'items-start' : 'items-end'}`}>
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
                <div className={`h-16 w-48 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse ${i % 2 === 0 ? 'rounded-tl-none' : 'rounded-tr-none'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide bg-[#f8fafc] dark:bg-[#0f172a]">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full opacity-60">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No messages in this secure channel.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start the professional conversation below.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message, index) => {
            const isSent = message.sender_id === currentUserId || (currentUsername && message.sender_username === currentUsername);
            const isSystem = message.sender_id === 'system-admin' || message.sender_username === 'System';
            const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;

            if (isSystem) {
              return (
                <div key={message.id} className="flex justify-center items-center py-2">
                  <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest border border-gray-200 dark:border-gray-700">
                    {message.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {showAvatar ? (
                  <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm ring-2 ring-white dark:ring-gray-900 ${isSent ? 'bg-primary-600' : 'bg-slate-500'
                    }`}>
                    {(message.sender_username?.[0] || 'U').toUpperCase()}
                  </div>
                ) : (
                  <div className="w-9" />
                )}

                <div className={`flex flex-col max-w-[80%] md:max-w-[70%] ${isSent ? 'items-end' : 'items-start'}`}>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 px-1 flex items-center gap-1.5">
                    {message.sender_username || 'Anonymous User'}
                  </span>

                  {/* Message Bubble */}
                  <div
                    className={`relative rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200 group-hover:shadow-md ${isSent
                      ? 'bg-primary-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200/60 dark:border-gray-700/60 rounded-tl-none'
                      }`}
                  >
                    {message.message_type === 'image' && message.media_url ? (
                      <div className="space-y-3">
                        <div className="relative overflow-hidden rounded-lg group/img">
                          <img
                            src={message.media_url}
                            alt="Shared"
                            className="max-w-full h-auto object-cover hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
                          />
                        </div>
                        {(message.original_content || message.content) && (
                          <p className="text-sm leading-relaxed font-medium">
                            {isSent || isAdmin ? (message.original_content || message.content) : message.content}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap">
                        {isSent || isAdmin ? (message.original_content || message.content) : message.content}
                      </p>
                    )}

                  </div>

                  <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">
                      {formatMessageTime(message.created_at)}
                    </span>
                    {isSent && (
                      <div className="flex -space-x-1">
                        {message.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-primary-500" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} className="h-px w-full" />
    </div>
  );
}

