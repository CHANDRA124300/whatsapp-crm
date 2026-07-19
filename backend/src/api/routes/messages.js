import { Router } from 'express';
import { MessageModel } from '../database/models/Message.js';
import { ConversationModel } from '../database/models/Conversation.js';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import { sendMessage, sendMediaMessage, sendPresenceUpdate } from '../baileys/connection.js';
import { formatPhoneNumber, extractPhoneNumber } from '../utils/helpers.js';

const router = Router();
const messageModel = new MessageModel(db);
const conversationModel = new ConversationModel(db);

// Get messages for a conversation
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const messages = await messageModel.getByConversation(conversationId, limit, offset);

    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send text message
router.post('/send', async (req, res) => {
  try {
    const { conversationId, content, templateId } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ success: false, error: 'Conversation ID and content required' });
    }

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Get customer phone
    const customer = await db.oneOrNone('SELECT phone FROM customers WHERE id = $1', [
      conversation.customer_id,
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const jid = formatPhoneNumber(customer.phone);

    try {
      // Send via WhatsApp
      await sendMessage(jid, { text: content });

      // Save to database
      const message = await messageModel.create({
        conversationId,
        senderType: 'agent',
        messageType: 'text',
        content,
        templateId,
        status: 'sent',
      });

      // Emit real-time event
      global.io?.emit('message:sent', {
        conversationId,
        message,
      });

      res.json({ success: true, data: message });
    } catch (whatsappError) {
      logger.error('Error sending WhatsApp message:', whatsappError);
      res.status(500).json({ success: false, error: 'Failed to send message via WhatsApp' });
    }
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send media message
router.post('/send-media', async (req, res) => {
  try {
    const { conversationId, mediaUrl, mediaType, caption } = req.body;

    if (!conversationId || !mediaUrl || !mediaType) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID, media URL, and type required',
      });
    }

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const customer = await db.oneOrNone('SELECT phone FROM customers WHERE id = $1', [
      conversation.customer_id,
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const jid = formatPhoneNumber(customer.phone);

    try {
      // Send via WhatsApp
      await sendMediaMessage(jid, mediaUrl, mediaType, caption);

      // Save to database
      const message = await messageModel.create({
        conversationId,
        senderType: 'agent',
        messageType: mediaType,
        content: caption || `[${mediaType.toUpperCase()}]`,
        mediaUrl,
        status: 'sent',
      });

      // Emit real-time event
      global.io?.emit('message:sent', { conversationId, message });

      res.json({ success: true, data: message });
    } catch (whatsappError) {
      logger.error('Error sending media:', whatsappError);
      res.status(500).json({ success: false, error: 'Failed to send media' });
    }
  } catch (error) {
    logger.error('Error sending media message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.markAsRead(id);

    res.json({ success: true, data: message });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send typing indicator
router.post('/:conversationId/typing', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const customer = await db.oneOrNone('SELECT phone FROM customers WHERE id = $1', [
      conversation.customer_id,
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const jid = formatPhoneNumber(customer.phone);
    await sendPresenceUpdate(jid, 'typing');

    // Emit real-time event
    global.io?.emit('typing:indicator', { conversationId, isTyping: true });

    res.json({ success: true, message: 'Typing indicator sent' });
  } catch (error) {
    logger.error('Error sending typing indicator:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send paused (stopped typing) indicator
router.post('/:conversationId/paused', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const customer = await db.oneOrNone('SELECT phone FROM customers WHERE id = $1', [
      conversation.customer_id,
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const jid = formatPhoneNumber(customer.phone);
    await sendPresenceUpdate(jid, 'paused');

    // Emit real-time event
    global.io?.emit('typing:indicator', { conversationId, isTyping: false });

    res.json({ success: true, message: 'Paused indicator sent' });
  } catch (error) {
    logger.error('Error sending paused indicator:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete message
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await messageModel.delete(id);

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
