import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import cron from 'node-cron';
import { sendMessage } from '../baileys/connection.js';
import { formatPhoneNumber } from '../utils/helpers.js';

const router = Router();

// Create scheduled message
router.post('/', async (req, res) => {
  try {
    const { conversationId, content, scheduledFor, createdBy } = req.body;

    if (!conversationId || !content || !scheduledFor) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID, content, and scheduled time required',
      });
    }

    const scheduled = await db.one(
      `INSERT INTO scheduled_messages (conversation_id, content, scheduled_for, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [conversationId, content, scheduledFor, createdBy],
    );

    res.json({ success: true, data: scheduled });
  } catch (error) {
    logger.error('Error creating scheduled message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scheduled messages
router.get('/', async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    const messages = await db.many(
      `SELECT sm.*, c.customer_id FROM scheduled_messages sm
       JOIN conversations c ON sm.conversation_id = c.id
       WHERE sm.status = $1
       ORDER BY scheduled_for ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset],
    );

    res.json({ success: true, data: messages, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching scheduled messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single scheduled message
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const scheduled = await db.oneOrNone(
      'SELECT * FROM scheduled_messages WHERE id = $1',
      [id],
    );

    if (!scheduled) {
      return res.status(404).json({ success: false, error: 'Scheduled message not found' });
    }

    res.json({ success: true, data: scheduled });
  } catch (error) {
    logger.error('Error fetching scheduled message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reschedule message
router.put('/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledFor } = req.body;

    if (!scheduledFor) {
      return res.status(400).json({ success: false, error: 'New schedule time required' });
    }

    const updated = await db.one(
      'UPDATE scheduled_messages SET scheduled_for = $1 WHERE id = $2 RETURNING *;',
      [scheduledFor, id],
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error rescheduling message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel scheduled message
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await db.one(
      'UPDATE scheduled_messages SET status = \'cancelled\' WHERE id = $1 RETURNING *;',
      [id],
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error canceling scheduled message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process scheduled messages (runs every minute)
export const processScheduledMessages = async () => {
  try {
    const messages = await db.many(
      `SELECT sm.*, c.customer_id, cu.phone 
       FROM scheduled_messages sm
       JOIN conversations c ON sm.conversation_id = c.id
       JOIN customers cu ON c.customer_id = cu.id
       WHERE sm.status = 'pending' AND scheduled_for <= NOW()
       LIMIT 100`,
    );

    for (const msg of messages) {
      try {
        const jid = formatPhoneNumber(msg.phone);
        await sendMessage(jid, { text: msg.content });

        // Update status
        await db.none(
          'UPDATE scheduled_messages SET status = \'sent\', sent_at = NOW() WHERE id = $1',
          [msg.id],
        );

        logger.info(`Scheduled message sent: ${msg.id}`);
      } catch (error) {
        logger.error(`Error sending scheduled message ${msg.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error processing scheduled messages:', error);
  }
};

// Schedule cron job
cron.schedule('* * * * *', processScheduledMessages);

export default router;
