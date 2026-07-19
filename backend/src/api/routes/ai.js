import { Router } from 'express';
import { generateAIResponse, generateAIResponseWithHistory } from '../services/aiService.js';
import { MessageModel } from '../database/models/Message.js';
import { ConversationModel } from '../database/models/Conversation.js';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import { sendMessage } from '../baileys/connection.js';
import { formatPhoneNumber } from '../utils/helpers.js';

const router = Router();
const messageModel = new MessageModel(db);
const conversationModel = new ConversationModel(db);

// Generate AI response
router.post('/generate', async (req, res) => {
  try {
    const { message, aiModel = 'gpt', context = '' } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message required' });
    }

    const response = await generateAIResponse(message, aiModel, context);

    res.json({ success: true, data: { response, model: aiModel } });
  } catch (error) {
    logger.error('Error generating AI response:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate AI response with conversation history
router.post('/generate-with-history', async (req, res) => {
  try {
    const { conversationId, aiModel = 'gpt', context = '' } = req.body;

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation ID required' });
    }

    // Get conversation history
    const messages = await messageModel.getByConversation(conversationId, 10, 0);
    const formattedMessages = messages.map((msg) => ({
      sender: msg.sender_type,
      content: msg.content,
    }));

    const response = await generateAIResponseWithHistory(formattedMessages, aiModel, context);

    res.json({ success: true, data: { response, model: aiModel } });
  } catch (error) {
    logger.error('Error generating AI response with history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send AI-generated reply
router.post('/send-reply', async (req, res) => {
  try {
    const { conversationId, aiModel = 'gpt', context = '' } = req.body;

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation ID required' });
    }

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Get conversation history
    const messages = await messageModel.getByConversation(conversationId, 10, 0);
    const formattedMessages = messages.map((msg) => ({
      sender: msg.sender_type,
      content: msg.content,
    }));

    // Generate AI response
    const aiResponse = await generateAIResponseWithHistory(formattedMessages, aiModel, context);

    // Get customer phone
    const customer = await db.oneOrNone('SELECT phone FROM customers WHERE id = $1', [
      conversation.customer_id,
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Send via WhatsApp
    const jid = formatPhoneNumber(customer.phone);
    await sendMessage(jid, { text: aiResponse });

    // Save to database
    const message = await messageModel.create({
      conversationId,
      senderType: 'agent',
      messageType: 'text',
      content: aiResponse,
      status: 'sent',
    });

    // Emit real-time event
    global.io?.emit('message:sent', { conversationId, message });

    res.json({ success: true, data: { message, model: aiModel } });
  } catch (error) {
    logger.error('Error sending AI reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
