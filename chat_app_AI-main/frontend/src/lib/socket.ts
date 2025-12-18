/**
 * FRONTEND SOCKET.IO CLIENT
 * ==========================
 * This module connects to the BACKEND Socket.IO server deployed on Render.
 * 
 * IMPORTANT:
 * - This file runs in the browser (client-side only)
 * - Connects to process.env.NEXT_PUBLIC_SOCKET_URL (backend URL)
 * - Uses Clerk token for authentication
 * - DO NOT import any server-side modules here
 * 
 * DEPLOYMENT NOTE:
 * The frontend on Vercel only uses this socket CLIENT to connect to the
 * backend WebSocket server. No server-side Socket.IO runs on Vercel.
 */

import { io, Socket } from 'socket.io-client';

// Backend WebSocket URL - MUST be set in Vercel environment variables
// Example: https://chat-backend-xyz.onrender.com
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

if (!process.env.NEXT_PUBLIC_SOCKET_URL && typeof window !== 'undefined') {
  console.warn('⚠️ NEXT_PUBLIC_SOCKET_URL not set - using localhost:4000');
}

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private token: string | null = null;

  /**
   * Connect to backend Socket.IO server with Clerk authentication token
   * @param token - Clerk session token from __session cookie or getToken()
   */
  connect(token: string): Socket {
    this.token = token;

    // If already connected, update the auth token for next reconnection
    if (this.socket) {
      this.socket.auth = { token };

      if (this.socket.connected) {
        return this.socket;
      }

      this.socket.connect();
      return this.socket;
    }

    try {
      console.log('🔌 Connecting to Socket.IO server:', SOCKET_URL);

      this.socket = io(SOCKET_URL, {
        // Send Clerk token for authentication
        auth: { token },

        // Use WebSocket transport for better performance
        // Fall back to polling if WebSocket fails
        transports: ['websocket', 'polling'],

        // Reconnection settings
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: this.maxReconnectAttempts,

        // Connection timeout
        timeout: 20000,

        // Enable credentials for CORS
        withCredentials: true,
      });

      // Connection event handlers
      this.socket.on('connect', () => {
        console.log('✅ Socket connected to backend');
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);

        if (reason === 'io server disconnect') {
          console.log('🔄 Server disconnected, attempting reconnect...');
          this.socket?.connect();
        } else if (reason === 'transport close') {
          console.warn('⚠️ Transport closed - WebSocket connection lost');
        }
      });

      this.socket.on('connect_error', (error) => {
        this.reconnectAttempts++;
        console.error(`Socket connection error (attempt ${this.reconnectAttempts}):`, error.message);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached. Real-time features unavailable.');
          this.socket?.close();
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        this.reconnectAttempts = 0;
      });

      return this.socket;
    } catch (error) {
      console.error('Failed to create socket connection:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Join a conversation
  joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot join conversation - socket not connected');
      return;
    }

    console.log('📍 Joining conversation:', conversationId);
    this.socket.emit('join-conversation', conversationId);
  }

  // Leave a conversation
  leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) return;

    console.log('📍 Leaving conversation:', conversationId);
    this.socket.emit('leave-conversation', conversationId);
  }

  // Send a message
  sendMessage(data: {
    receiverId: string;
    content: string;
    conversationId: string;
    applyTone?: boolean;
    toneType?: 'professional' | 'polite' | 'formal' | 'auto';
    mediaUrl?: string;
  }): void {
    if (!this.socket?.connected) {
      console.error('Cannot send message - socket not connected');
      return;
    }

    console.log('📤 Sending message via Socket.IO');
    this.socket.emit('send-message', data);
  }

  // Typing indicators
  startTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('typing', { conversationId, isTyping: true });
  }

  stopTyping(conversationId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('typing', { conversationId, isTyping: false });
  }

  // Mark messages as read
  markAsRead(conversationId: string, messageId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('mark-read', { conversationId, messageId });
  }

  // Heartbeat
  sendHeartbeat(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('heartbeat');
  }

  // Listen to events
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      console.warn(`Cannot listen to event "${event}" - socket not initialized`);
      return;
    }
    this.socket.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
