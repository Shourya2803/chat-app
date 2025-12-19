'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUIStore } from '@/store/uiStore';
import { useApiClient } from '@/lib/api';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

const toast = {
  error: (msg: string) => console.error('Error:', msg),
  success: (msg: string) => console.log('Success:', msg),
};

interface MessageInputProps {
  dbUserId?: string;
}

export default function MessageInput({ dbUserId }: MessageInputProps) {
  const { user } = useUser();
  const api = useApiClient();
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addMessage, removeMessage } = useChatStore();

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

    // Optimistic UI setup
    const content = message.trim() || 'Image';
    const tempId = `temp_${Date.now()}`;
    const prevMessage = message;

    // Clear inputs immediately
    setMessage('');
    removeImage();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Don't set sending=true to block UI, just track it internally if needed
    // or set it but don't disable input/button effectively? 
    // User wants "no loading". So we won't disable the button visibly or show spinner.
    // But we should prevent double submit.
    setSending(true);

    // Optimistic Message Addition
    if (user) {
      addMessage({
        id: tempId,
        conversation_id: 'global-group',
        sender_id: dbUserId || user.id, // Use DB user ID if available for correct alignment
        sender_username: user.username || user.firstName || 'You',
        receiver_id: 'global-group',
        content: content,
        original_content: content,
        message_type: imageFile ? 'image' : 'text',
        media_url: imagePreview || undefined, // Use preview as placeholder
        status: 'sending',
        is_read: false,
        read_at: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

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
          // Restore message on failure
          setMessage(prevMessage);
          return;
        } finally {
          setUploading(false);
        }
      }

      // Optimistic update - add to store immediately
      // Note: We need the current user ID for this. Since we can't easily get it inside this function 
      // without passing it as props or using a hook context in a way that might not be available here,
      // we'll rely on the API response to be fast. 
      // OR better: The user will see their message appear when the API returns success, 
      // but we'll show a "sending..." state in the UI if needed.
      // 
      // HOWEVER, the user explicitly asked "dont want to see the loading".
      // So we will optimistically add it to the chat store.

      const { addMessage } = useChatStore.getState();
      // We need these values to be accurate. 
      // It's better to fetch user from the hook in the component body and use it here.

      // API Call
      const apiPayload = {
        content: content,
        mediaUrl: mediaUrl,
      };

      console.log('📤 Sending message via API:', apiPayload);

      const response = await api.post(`/send-message`, apiPayload);

      if (response.data.success) {
        console.log('✅ Message sent successfully');

        // Immediately update the UI with the server response (which has the converted AI text)
        const serverMessage = response.data.data.message;

        // Patch: If server returns 'Anonymous' but we know the username, use it
        if (serverMessage.sender_username === 'Anonymous' && user?.username) {
          serverMessage.sender_username = user.username;
        }

        // Remove the optimistic temp message to prevent duplicates
        removeMessage(tempId);

        // Add the real message from server
        addMessage(serverMessage);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      setMessage(prevMessage); // Restore draft
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
          disabled={(!message.trim() && !imageFile) && !uploading}
          className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

