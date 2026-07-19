import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import { sendCard } from '../handlers/messageBuilder.js';
import { formatPhoneNumber } from '../utils/helpers.js';

const router = Router();

// Create card
router.post('/', async (req, res) => {
  try {
    const { title, description, imageUrl, actionUrl, actionText } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title required' });
    }

    const card = await db.one(
      `INSERT INTO cards (title, description, image_url, action_url, action_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [title, description, imageUrl, actionUrl, actionText],
    );

    res.json({ success: true, data: card });
  } catch (error) {
    logger.error('Error creating card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all cards
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const cards = await db.many(
      'SELECT * FROM cards ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );

    res.json({ success: true, data: cards, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching cards:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single card
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const card = await db.oneOrNone('SELECT * FROM cards WHERE id = $1', [id]);

    if (!card) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }

    res.json({ success: true, data: card });
  } catch (error) {
    logger.error('Error fetching card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send card to conversation
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'Conversation ID required' });
    }

    const card = await db.oneOrNone('SELECT * FROM cards WHERE id = $1', [id]);
    if (!card) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }

    // Get customer phone
    const conversation = await db.oneOrNone(
      'SELECT customer_id FROM conversations WHERE id = $1',
      [conversationId],
    );

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const customer = await db.oneOrNone('SELECT phone FROM customers WHERE id = $1', [
      conversation.customer_id,
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    try {
      const jid = formatPhoneNumber(customer.phone);
      await sendCard(jid, card);

      // Link card to message
      const message = await db.one(
        `INSERT INTO messages (conversation_id, sender_type, message_type, content)
         VALUES ($1, 'agent', 'card', $2)
         RETURNING *;`,
        [conversationId, card.title],
      );

      await db.none(
        'UPDATE cards SET message_id = $1 WHERE id = $2',
        [message.id, id],
      );

      res.json({ success: true, data: message });
    } catch (whatsappError) {
      logger.error('Error sending card:', whatsappError);
      res.status(500).json({ success: false, error: 'Failed to send card' });
    }
  } catch (error) {
    logger.error('Error sending card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update card
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, imageUrl, actionUrl, actionText } = req.body;

    const updated = await db.one(
      `UPDATE cards SET title = COALESCE($1, title), description = COALESCE($2, description),
       image_url = COALESCE($3, image_url), action_url = COALESCE($4, action_url),
       action_text = COALESCE($5, action_text) WHERE id = $6 RETURNING *;`,
      [title, description, imageUrl, actionUrl, actionText, id],
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete card
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.none('DELETE FROM cards WHERE id = $1', [id]);

    res.json({ success: true, message: 'Card deleted' });
  } catch (error) {
    logger.error('Error deleting card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
