import { Router } from 'express';
import { ConversationModel } from '../database/models/Conversation.js';
import { CustomerModel } from '../database/models/Customer.js';
import { MessageModel } from '../database/models/Message.js';
import db from '../database/connection.js';
import logger from '../utils/logger.js';

const router = Router();
const conversationModel = new ConversationModel(db);
const customerModel = new CustomerModel(db);
const messageModel = new MessageModel(db);

// Get all conversations (Inbox)
router.get('/', async (req, res) => {
  try {
    const { status = 'active', assignedTo, limit = 50, offset = 0 } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (assignedTo) filters.assignedTo = assignedTo;

    const conversations = await conversationModel.getAll(limit, offset, filters);

    // Enrich with customer info
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const customer = await customerModel.findById(conv.customer_id);
        return { ...conv, customer };
      }),
    );

    res.json({
      success: true,
      data: enrichedConversations,
      pagination: { limit, offset },
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single conversation
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await conversationModel.findById(id);

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const customer = await customerModel.findById(conversation.customer_id);
    const messages = await messageModel.getByConversation(id, 50, 0);

    res.json({
      success: true,
      data: {
        ...conversation,
        customer,
        messages,
      },
    });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search conversations
router.get('/search/query', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const customers = await customerModel.search(q);
    const conversations = await Promise.all(
      customers.map((customer) => conversationModel.findByCustomerId(customer.id)),
    );

    const results = conversations
      .filter((c) => c !== null)
      .map((conv, idx) => ({ ...conv, customer: customers[idx] }));

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Error searching conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update conversation status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'resolved', 'pending', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updated = await conversationModel.update(id, { status });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating conversation status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark conversation as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await conversationModel.markAsRead(id);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error marking conversation as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark conversation as unread
router.put('/:id/unread', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await conversationModel.markAsUnread(id);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error marking conversation as unread:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Assign conversation to agent
router.put('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    const updated = await conversationModel.assignTo(id, userId);

    // Emit real-time event
    global.io?.emit('conversation:assigned', { conversationId: id, userId });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error assigning conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transfer conversation
router.post('/:id/transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const { fromAgentId, toAgentId, reason } = req.body;

    const transferred = await db.one(
      `INSERT INTO chat_transfers (conversation_id, from_agent, to_agent, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [id, fromAgentId, toAgentId, reason],
    );

    await conversationModel.assignTo(id, toAgentId);

    // Emit real-time event
    global.io?.emit('conversation:transferred', {
      conversationId: id,
      fromAgentId,
      toAgentId,
    });

    res.json({ success: true, data: transferred });
  } catch (error) {
    logger.error('Error transferring conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
