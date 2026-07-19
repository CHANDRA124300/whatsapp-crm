import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import { sendButtonMessage, sendListMessage } from '../baileys/connection.js';
import { formatPhoneNumber } from '../utils/helpers.js';

const router = Router();

// Send button message
router.post('/send', async (req, res) => {
  try {
    const { conversationId, contentText, footerText, buttons } = req.body;

    if (!conversationId || !contentText || !buttons || buttons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID, content text, and buttons required',
      });
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

    const jid = formatPhoneNumber(customer.phone);

    try {
      // Send button message
      await sendButtonMessage(jid, {
        contentText,
        footerText,
        buttons: buttons.map((btn) => ({
          buttonId: btn.id,
          buttonText: { displayText: btn.text },
          type: 1,
        })),
      });

      // Save message with buttons
      const message = await db.one(
        `INSERT INTO messages (conversation_id, sender_type, message_type, content, buttons, status)
         VALUES ($1, 'agent', 'button', $2, $3, 'sent')
         RETURNING *;`,
        [conversationId, contentText, JSON.stringify(buttons)],
      );

      res.json({ success: true, data: message });
    } catch (whatsappError) {
      logger.error('Error sending button message:', whatsappError);
      res.status(500).json({ success: false, error: 'Failed to send button message' });
    }
  } catch (error) {
    logger.error('Error sending button message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send list message
router.post('/list', async (req, res) => {
  try {
    const { conversationId, contentText, title, sections, buttonText } = req.body;

    if (!conversationId || !contentText || !sections || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID, content, and sections required',
      });
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

    const jid = formatPhoneNumber(customer.phone);

    try {
      // Send list message
      await sendListMessage(jid, {
        text: contentText,
        title,
        sections,
        buttonText: buttonText || 'Select Option',
      });

      // Save message
      const message = await db.one(
        `INSERT INTO messages (conversation_id, sender_type, message_type, content, buttons, status)
         VALUES ($1, 'agent', 'list', $2, $3, 'sent')
         RETURNING *;`,
        [conversationId, contentText, JSON.stringify(sections)],
      );

      res.json({ success: true, data: message });
    } catch (whatsappError) {
      logger.error('Error sending list message:', whatsappError);
      res.status(500).json({ success: false, error: 'Failed to send list message' });
    }
  } catch (error) {
    logger.error('Error sending list message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track button click
router.post('/:buttonId/click', async (req, res) => {
  try {
    const { buttonId } = req.params;

    const updated = await db.one(
      `UPDATE buttons SET click_count = click_count + 1, clicked_at = NOW() WHERE id = $1 RETURNING *;`,
      [buttonId],
    );

    // Emit real-time event
    global.io?.emit('button:clicked', { buttonId, clickCount: updated.click_count });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error tracking button click:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get button analytics
router.get('/:messageId/analytics', async (req, res) => {
  try {
    const { messageId } = req.params;

    const buttons = await db.many(
      'SELECT * FROM buttons WHERE message_id = $1',
      [messageId],
    );

    const totalClicks = buttons.reduce((sum, btn) => sum + btn.click_count, 0);

    res.json({
      success: true,
      data: {
        buttons,
        totalClicks,
        averageClicks: buttons.length > 0 ? totalClicks / buttons.length : 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching button analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
