'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useUIStore } from '@/store/uiStore';
import socketService from '@/lib/socket';
import { useApiClient } from '@/lib/api';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

const toast = {
  error: (msg: string) => console.error('Error:', msg),
  success: (msg: string) => console.log('Success:', msg),
};

export default function MessageInput() {
  const api = useApiClient();
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !imageFile) || sending) return;

    setSending(true);

    try {
      let mediaUrl: string | undefined;

      // Upload image first if present
      if (imageFile) {
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('image', imageFile);

          const response = await api.post('/upload/image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          mediaUrl = response.data.data.url;
          toast.success('Image uploaded');
        } catch (error) {
          console.error('Failed to upload image:', error);
          toast.error('Failed to upload image');
          return;
        } finally {
          setUploading(false);
        }
      }

      // Use Socket.IO if connected, otherwise fallback to REST API
      const useSocket = socketService.isConnected();

      if (useSocket) {
        // Use Socket.IO
        const messagePayload = {
          content: message.trim() || 'Image',
          mediaUrl,
        };

        console.log('Sending via Socket.IO:', messagePayload);
        socketService.sendMessage(messagePayload);
      } else {
        // Use REST API (Fallback)
        const apiPayload = {
          content: message.trim() || 'Image',
          mediaUrl: mediaUrl,
        };

        console.log('Sending via REST API (Fallback):', apiPayload);

        try {
          const response = await api.post(`/messages/conversation/global-group`, apiPayload);

          if (response.data.success) {
            useChatStore.getState().addMessage(response.data.data);
          }
        } catch (error) {
          console.error('Failed to send message via API:', error);
          throw error;
        }
      }

      // Clear input
      setMessage('');
      removeImage();

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    socketService.startTyping('global-group');

    // Stop typing after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      socketService.stopTyping('global-group');
    }, 3000);

    return () => clearTimeout(timeout);
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
      {/* Image Preview */}
      {imagePreview && (
        <div
          className="mb-3 relative inline-block"
        >
          <img
            src={imagePreview}
            alt="Preview"
            className="h-24 rounded-lg border border-gray-300 dark:border-gray-600"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Always-on AI enabled status info could go here or header */}

      <div className="flex items-end gap-2">
        {/* Image upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          <ImageIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Message input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            adjustTextareaHeight();
            handleTyping();
          }}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          rows={1}
          disabled={uploading || sending}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none max-h-32 disabled:opacity-50"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!message.trim() && !imageFile) || uploading || sending}
          className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading || sending ? (
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
          ) : (
            <Send className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
}

