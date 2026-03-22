export interface Conversation {
  id: string;
  tenant_id: string;
  name?: string;
  type: 'group' | 'direct';
  created_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  profile_id: string;
  last_read_at?: string;
}

export interface Message {
  id: string;
  tenant_id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}
