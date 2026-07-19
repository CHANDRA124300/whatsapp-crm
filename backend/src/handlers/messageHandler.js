import logger from '../utils/logger.js';
import { MessageModel } from '../database/models/Message.js';
import { ConversationModel } from '../database/models/Conversation.js';
import { CustomerModel } from '../database/models/Customer.js';
import db from '../database/connection.js';
import { extractPhoneNumber } from '../utils/helpers.js';

const messageModel = new MessageModel(db);
const conversationModel = new ConversationModel(db);
const customerModel = new CustomerModel(db);

export const initializeMessageHandlers = (sock) => {
  // Handle incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0];

    if (!message.message) return;
    if (message.key.fromMe) return; // Ignore own messages
    if (message.isGroup) return; // Skip group messages for now

    try {
      await handleIncomingMessage(message, sock);
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  });

  // Handle message updates (read, delivered)
  sock.ev.on('message.update', async (updates) => {
    for (const update of updates) {
      try {
        await handleMessageUpdate(update);
      } catch (error) {
        logger.error('Error handling message update:', error);
      }
    }
  });

  // Handle chat updates
  sock.ev.on('chats.update', async (chats) => {
    logger.info(`Chat update: ${chats.length} chats`);
  });

  // Handle presence update
  sock.ev.on('presence.update', async (presenceUpdates) => {
    for (const presence of presenceUpdates) {
      logger.info(`Presence: ${presence.id} - ${presence.lastKnownPresence}`);
    }
  });
};

export const handleIncomingMessage = async (message, sock) => {
  const senderJid = message.key.remoteJid;
  const phoneNumber = extractPhoneNumber(senderJid);
  const messageContent = extractMessageContent(message);
  const messageType = getMessageType(message);
  const timestamp = message.messageTimestamp;

  logger.info(`📨 Message from ${phoneNumber}: ${messageContent.substring(0, 50)}...`);

  try {
    // Get or create customer
    let customer = await customerModel.findByPhone(phoneNumber);
    if (!customer) {
      customer = await customerModel.create({
        phone: phoneNumber,
        name: message.pushName || 'Unknown',
        source: 'whatsapp',
      });
      logger.info(`✨ New customer created: ${customer.id}`);
    }

    // Get or create conversation
    let conversation = await conversationModel.findByCustomerId(customer.id);
    if (!conversation) {
      conversation = await conversationModel.create({
        customerId: customer.id,
      });
      logger.info(`💬 New conversation created: ${conversation.id}`);
    }

    // Save message to database
    const savedMessage = await messageModel.create({
      conversationId: conversation.id,
      senderType: 'customer',
      messageType,
      content: messageContent,
      whatsappMessageId: message.key.id,
      status: 'delivered',
    });

    logger.info(`✅ Message saved: ${savedMessage.id}`);

    // Update conversation
    await conversationModel.update(conversation.id, {
      lastMessagePreview: messageContent.substring(0, 100),
      messageCount: (conversation.messageCount || 0) + 1,
    });

    // Update customer last message time
    await customerModel.update(customer.id, {
      lastMessageAt: new Date(),
    });

    // Emit real-time event
    global.io?.emit('message:received', {
      conversationId: conversation.id,
      customerId: customer.id,
      message: savedMessage,
    });

    // Send read receipt
    await sock.readMessages([message.key]);

  } catch (error) {
    logger.error('Error processing incoming message:', error);
  }
};

export const handleMessageUpdate = async (update) => {
  const { key, update: updateData } = update;

  try {
    if (updateData.status) {
      const statusMap = {
        1: 'sent',
        2: 'delivered',
        3: 'read',
      };
      const status = statusMap[updateData.status] || 'sent';
      
      logger.info(`Message ${key.id} status: ${status}`);
      
      // Update in database
      // You can implement this based on storing whatsappMessageId
    }
  } catch (error) {
    logger.error('Error handling message update:', error);
  }
};

export const extractMessageContent = (message) => {
  const msg = message.message;

  if (msg.conversation) {
    return msg.conversation;
  }
  if (msg.extendedTextMessage) {
    return msg.extendedTextMessage.text;
  }
  if (msg.imageMessage) {
    return msg.imageMessage.caption || '[Image]';
  }
  if (msg.videoMessage) {
    return msg.videoMessage.caption || '[Video]';
  }
  if (msg.audioMessage) {
    return '[Audio]';
  }
  if (msg.documentMessage) {
    return `[Document: ${msg.documentMessage.fileName}]`;
  }
  if (msg.stickerMessage) {
    return '[Sticker]';
  }
  if (msg.buttonsResponseMessage) {
    return msg.buttonsResponseMessage.selectedButtonId;
  }
  if (msg.listResponseMessage) {
    return msg.listResponseMessage.singleSelectReply?.selectedRowId;
  }

  return '[Unknown Message]';
};

export const getMessageType = (message) => {
  const msg = message.message;

  if (msg.conversation || msg.extendedTextMessage) return 'text';
  if (msg.imageMessage) return 'image';
  if (msg.videoMessage) return 'video';
  if (msg.audioMessage) return 'audio';
  if (msg.documentMessage) return 'document';
  if (msg.buttonsResponseMessage) return 'button';
  if (msg.listResponseMessage) return 'list';

  return 'unknown';
};
