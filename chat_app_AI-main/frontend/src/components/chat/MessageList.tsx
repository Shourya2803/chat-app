'use client';

import { useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Check, CheckCheck, Image as ImageIcon } from 'lucide-react';
import type { Message } from '@/store/chatStore';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  currentUserId: string;
}

export default function MessageList({ messages, loading, currentUserId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, 'HH:mm');
    } else if (isYesterday(messageDate)) {
      return `Yesterday ${format(messageDate, 'HH:mm')}`;
    } else {
      return format(messageDate, 'MMM dd, HH:mm');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        <>
          {messages.map((message, index) => {
            const isSent = message.sender_id === currentUserId;
            const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;

            return (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {showAvatar && (
                  <div className={`w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-semibold ${!showAvatar && 'invisible'}`}>
                    {isSent ? 'You' : 'U'}
                  </div>
                )}
                {!showAvatar && <div className="w-8" />}

                <div className={`flex flex-col max-w-[70%] ${isSent ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-2 break-words shadow-sm ${
                      isSent
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {message.message_type === 'image' && message.media_url ? (
                      <div className="space-y-2">
                        <img
                          src={message.media_url}
                          alt="Shared image"
                          className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(message.media_url, '_blank')}
                        />
                        {message.content && (
                          <p className="text-sm">{message.content}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}

                    {/* Tone indicator (only visible to sender) */}
                    {isSent && message.tone_applied && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-primary-200">
                          AI: {message.tone_applied}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Message metadata */}
                  <div className="flex items-center gap-1 mt-1 px-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatMessageTime(message.created_at)}
                    </span>
                    {isSent && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {message.is_read ? (
                          <CheckCheck className="w-4 h-4 text-primary-600" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Original message preview (only visible to sender) */}
                  {isSent && message.original_content && message.original_content !== message.content && (
                    <details className="mt-1 cursor-pointer">
                      <summary className="text-xs text-primary-300">
                        View original
                      </summary>
                      <p className="text-xs mt-1 italic text-primary-200">
                        "{message.original_content}"
                      </p>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

