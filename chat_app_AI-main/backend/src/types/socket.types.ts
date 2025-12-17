/**
 * SOCKET.IO EVENT TYPE DEFINITIONS
 * =================================
 * Type-safe event payloads for all Socket.IO events
 */

// ========================================
// BASE TYPES
// ========================================

export interface User {
  id: string;
  clerkId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  original_content: string | null;
  tone_applied: string | null;
  message_type: string;
  media_url: string | null;
  status: string;
  is_read: boolean;
  read_at: Date | null;
  is_edited: boolean;
  edited_at: Date | null;
  is_deleted: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ========================================
// CLIENT → SERVER EVENTS
// ========================================

export interface ClientToServerEvents {
  // Conversation management
  'join-conversation': (conversationId: string) => void;
  'leave-conversation': (conversationId: string) => void;

  // Send message
  'send-message': (data: SendMessagePayload) => void;

  // Read receipts
  'message:read': (data: MessageReadPayload) => void;

  // Typing indicators
  'typing:start': (data: TypingPayload) => void;
  'typing:stop': (data: TypingPayload) => void;

  // Message edit & delete
  'message:edit': (data: MessageEditPayload) => void;
  'message:delete': (data: MessageDeletePayload) => void;

  // Message reactions
  'message:react': (data: MessageReactionPayload) => void;

  // Presence
  'heartbeat': () => void;
}

// ========================================
// SERVER → CLIENT EVENTS
// ========================================

export interface ServerToClientEvents {
  // Message events
  'message-sent': (message: Message) => void;
  'new-message': (message: Message) => void;
  'message-error': (error: { error: string; code?: string }) => void;

  // Read receipts
  'message:read:update': (data: MessageReadUpdatePayload) => void;

  // Typing indicators
  'user:typing': (data: UserTypingPayload) => void;

  // Message edit & delete
  'message:edited': (data: MessageEditedPayload) => void;
  'message:deleted': (data: MessageDeletedPayload) => void;

  // Message reactions
  'message:reaction:added': (data: ReactionUpdatePayload) => void;
  'message:reaction:removed': (data: ReactionUpdatePayload) => void;

  // Presence
  'user-status': (data: UserStatusPayload) => void;
}

// ========================================
// SEND MESSAGE
// ========================================

export interface SendMessagePayload {
  conversationId: string;
  receiverId: string;
  content: string;
  mediaUrl?: string;
  applyTone?: boolean;
  toneType?: 'professional' | 'polite' | 'formal' | 'auto';
}

// ========================================
// READ RECEIPTS
// ========================================

export interface MessageReadPayload {
  messageId: string;
  conversationId: string;
}

export interface MessageReadUpdatePayload {
  messageId: string;
  conversationId: string;
  userId: string;
  username: string | null;
  readAt: Date;
}

// ========================================
// TYPING INDICATORS
// ========================================

export interface TypingPayload {
  conversationId: string;
}

export interface UserTypingPayload {
  conversationId: string;
  userId: string;
  username: string | null;
  isTyping: boolean;
}

// ========================================
// MESSAGE EDIT
// ========================================

export interface MessageEditPayload {
  messageId: string;
  conversationId: string;
  newContent: string;
}

export interface MessageEditedPayload {
  messageId: string;
  conversationId: string;
  newContent: string;
  editedAt: Date;
  senderId: string;
}

// ========================================
// MESSAGE DELETE
// ========================================

export interface MessageDeletePayload {
  messageId: string;
  conversationId: string;
}

export interface MessageDeletedPayload {
  messageId: string;
  conversationId: string;
  deletedAt: Date;
  senderId: string;
}

// ========================================
// MESSAGE REACTIONS
// ========================================

export interface MessageReactionPayload {
  messageId: string;
  conversationId: string;
  emoji: string; // e.g., "👍", "❤️", "😂"
}

export interface ReactionUpdatePayload {
  messageId: string;
  conversationId: string;
  userId: string;
  username: string | null;
  emoji: string;
  reactionCounts: Record<string, number>; // { "👍": 3, "❤️": 2 }
}

// ========================================
// PRESENCE
// ========================================

export interface UserStatusPayload {
  userId: string;
  status: 'online' | 'offline';
  lastSeen: number;
}

// ========================================
// INTER-SERVER EVENTS (for scaling)
// ========================================

export interface InterServerEvents {
  ping: () => void;
}

// ========================================
// SOCKET DATA (stored on socket instance)
// ========================================

export interface SocketData {
  userId: string;
  clerkId: string;
  username: string | null;
}
