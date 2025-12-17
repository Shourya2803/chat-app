/**
 * EXAMPLE: Using Socket.IO Client in React Component
 * ===================================================
 * This file demonstrates how to use the refactored Socket.IO client
 * in a React component. This is for FRONTEND only.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import socketService from '@/lib/socket';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  original_content?: string;
  tone_applied?: string;
  created_at: Date;
}

export default function ExampleChatComponent() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [applyTone, setApplyTone] = useState(false);
  const [toneType, setToneType] = useState<'professional' | 'polite' | 'formal' | 'auto'>('professional');
  
  const conversationId = 'example-conversation-id'; // Replace with actual conversation ID
  const receiverId = 'example-receiver-id'; // Replace with actual receiver ID

  // ========================================
  // STEP 1: CONNECT TO SOCKET.IO
  // ========================================
  useEffect(() => {
    if (!user) return;

    // Get Clerk session token
    const connectSocket = async () => {
      try {
        // Get token from Clerk (this returns the __session cookie value)
        // @ts-ignore
        const token = await user.getToken();
        
        if (!token) {
          console.error('No token available');
          return;
        }

        // Connect to backend Socket.IO server
        const socket = socketService.connect(token);
        
        // Update connection status
        setIsConnected(socket.connected);
      } catch (error) {
        console.error('Failed to connect socket:', error);
      }
    };

    connectSocket();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, [user]);

  // ========================================
  // STEP 2: JOIN CONVERSATION ROOM
  // ========================================
  useEffect(() => {
    if (!isConnected || !conversationId) return;

    socketService.joinConversation(conversationId);

    return () => {
      socketService.leaveConversation(conversationId);
    };
  }, [isConnected, conversationId]);

  // ========================================
  // STEP 3: LISTEN FOR SOCKET EVENTS
  // ========================================
  useEffect(() => {
    // Handle connection status changes
    socketService.on('connect', () => {
      console.log('✅ Connected to backend');
      setIsConnected(true);
    });

    socketService.on('disconnect', () => {
      console.log('❌ Disconnected from backend');
      setIsConnected(false);
    });

    // Handle new messages from other users
    const handleNewMessage = (message: Message) => {
      console.log('📩 New message received:', message);
      setMessages((prev) => [...prev, message]);
    };

    // Handle confirmation of sent message
    const handleMessageSent = (message: Message) => {
      console.log('📨 Message sent confirmation:', message);
      // Message was successfully sent and saved to database
      // You might want to update the message status in your UI
    };

    // Handle message sending errors
    const handleMessageError = (error: { error: string }) => {
      console.error('❌ Message error:', error);
      alert(`Failed to send message: ${error.error}`);
    };

    // Listen for events
    socketService.on('new-message', handleNewMessage);
    socketService.on('message-sent', handleMessageSent);
    socketService.on('message-error', handleMessageError);

    // Cleanup listeners on unmount
    return () => {
      socketService.off('new-message', handleNewMessage);
      socketService.off('message-sent', handleMessageSent);
      socketService.off('message-error', handleMessageError);
    };
  }, []);

  // ========================================
  // STEP 4: SEND MESSAGE VIA SOCKET.IO
  // ========================================
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) return;
    if (!isConnected) {
      alert('Not connected to chat server. Please refresh the page.');
      return;
    }

    try {
      // Send message via Socket.IO (NOT HTTP POST!)
      socketService.sendMessage({
        conversationId,
        receiverId,
        content: newMessage,
        applyTone,
        toneType,
      });

      // Optimistically add message to UI (optional)
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: user?.id || '',
        receiver_id: receiverId,
        content: newMessage,
        created_at: new Date(),
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      // Clear input
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  // ========================================
  // STEP 5: SEND TYPING INDICATOR
  // ========================================
  const handleTyping = () => {
    if (!isConnected) return;
    socketService.startTyping(conversationId);
  };

  const handleStopTyping = () => {
    if (!isConnected) return;
    socketService.stopTyping(conversationId);
  };

  // ========================================
  // STEP 6: SEND HEARTBEAT (PRESENCE)
  // ========================================
  useEffect(() => {
    if (!isConnected) return;

    // Send heartbeat every 30 seconds to maintain online status
    const interval = setInterval(() => {
      socketService.sendHeartbeat();
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // ========================================
  // RENDER UI
  // ========================================
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      {/* Connection Status */}
      <div className="mb-4 p-2 rounded bg-gray-100">
        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        {isConnected ? 'Connected to chat server' : 'Disconnected'}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded ${
              message.sender_id === user?.id
                ? 'bg-blue-500 text-white ml-auto'
                : 'bg-gray-200 text-black'
            } max-w-xs`}
          >
            <p>{message.content}</p>
            {message.tone_applied && (
              <p className="text-xs opacity-75 mt-1">
                Tone: {message.tone_applied}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Tone Selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={applyTone}
            onChange={(e) => setApplyTone(e.target.checked)}
          />
          <span>Apply Tone</span>
        </label>

        {applyTone && (
          <select
            value={toneType}
            onChange={(e) => setToneType(e.target.value as any)}
            className="border rounded px-2 py-1"
          >
            <option value="professional">Professional</option>
            <option value="polite">Polite</option>
            <option value="formal">Formal</option>
            <option value="auto">Auto</option>
          </select>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onFocus={handleTyping}
          onBlur={handleStopTyping}
          placeholder="Type a message..."
          className="flex-1 border rounded px-4 py-2"
          disabled={!isConnected}
        />
        <button
          type="submit"
          disabled={!isConnected || !newMessage.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

/**
 * KEY DIFFERENCES FROM OLD MONOLITHIC APPROACH:
 * =============================================
 * 
 * OLD (Monolithic - Vercel doesn't support this):
 * ------------------------------------------------
 * - Socket.IO server running in Next.js custom server
 * - Connected to localhost:3000
 * - Prisma/Redis/Gemini in same codebase
 * - Everything deployed to Vercel (breaks WebSocket)
 * 
 * NEW (Separated - Vercel compatible):
 * ------------------------------------
 * - Socket.IO CLIENT only in frontend
 * - Connects to external backend URL (Render)
 * - No database access in frontend
 * - Frontend on Vercel, Backend on Render
 * - Clean separation of concerns
 * 
 * IMPORTANT NOTES:
 * ================
 * 1. NEVER call HTTP POST to send messages - use socketService.sendMessage()
 * 2. NEVER import Prisma/Redis in frontend - they live in backend only
 * 3. ALWAYS use NEXT_PUBLIC_SOCKET_URL from environment variables
 * 4. ALWAYS pass Clerk token when connecting
 * 5. Backend verifies token and maps to database user
 * 
 * DEPLOYMENT CHECKLIST:
 * =====================
 * ✅ Backend deployed to Render with DATABASE_URL, REDIS_URL, etc.
 * ✅ Frontend deployed to Vercel with NEXT_PUBLIC_SOCKET_URL
 * ✅ Backend CORS allows frontend domain
 * ✅ Clerk keys match between frontend and backend
 * ✅ Test connection: check browser console for "✅ Socket connected to backend"
 */
