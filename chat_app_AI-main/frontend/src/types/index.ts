export interface User {
  id: string;
  clerk_id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  status: string;
  last_seen: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  original_content?: string;
  message_type: 'text' | 'image';
  media_url?: string;
  tone_applied?: 'professional' | 'polite' | 'formal';
  status: 'sent' | 'delivered' | 'read';
  is_read: boolean;
  read_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  conversation_id: string;
  last_message_at: Date;
  other_user: User;
  last_message?: Message;
  unread_count: number;
}

export type ToneType = 'professional' | 'polite' | 'formal' | null;

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: any[];
}
