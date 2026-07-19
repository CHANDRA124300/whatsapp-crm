export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  BUTTON: 'button',
  LIST: 'list',
  CARD: 'card',
};

export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  PENDING: 'pending',
  CLOSED: 'closed',
};

export const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

export const USER_ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent',
  MANAGER: 'manager',
  USER: 'user',
};

export const BROADCAST_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const WEBHOOK_EVENTS = {
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  CHAT_ASSIGNED: 'chat.assigned',
  CONTACT_CREATED: 'contact.created',
  BROADCAST_SENT: 'broadcast.sent',
};
