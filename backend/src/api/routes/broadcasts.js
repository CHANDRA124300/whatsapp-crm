import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import { sendMessage, sendButtonMessage, sendListMessage } from '../baileys/connection.js';
import { formatPhoneNumber } from '../utils/helpers.js';

const router = Router();

// Create broadcast
router.post('/', async (req, res) => {
  try {
    const { name, message, templateId, targetSegment, recipientIds, createdBy } = req.body;

    if (!name || !message) {
      return res.status(400).json({ success: false, error: 'Name and message required' });
    }

    const broadcast = await db.one(
      `INSERT INTO broadcasts (name, message, template_id, target_segment, created_by, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING *;`,
      [name, message, templateId, targetSegment, createdBy],
    );

    res.json({ success: true, data: broadcast });
  } catch (error) {
    logger.error('Error creating broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all broadcasts
router.get('/', async (req, res) => {
  try {
    const { status = 'draft', limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM broadcasts WHERE 1=1';
    const params = [];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const broadcasts = await db.many(query, params);

    res.json({ success: true, data: broadcasts, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching broadcasts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single broadcast
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await db.oneOrNone('SELECT * FROM broadcasts WHERE id = $1', [id]);

    if (!broadcast) {
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }

    res.json({ success: true, data: broadcast });
  } catch (error) {
    logger.error('Error fetching broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Schedule broadcast
router.put('/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ success: false, error: 'Schedule time required' });
    }

    const broadcast = await db.one(
      `UPDATE broadcasts SET status = 'scheduled', scheduled_at = $1 WHERE id = $2 RETURNING *;`,
      [scheduledAt, id],
    );

    res.json({ success: true, data: broadcast });
  } catch (error) {
    logger.error('Error scheduling broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send broadcast
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await db.oneOrNone('SELECT * FROM broadcasts WHERE id = $1', [id]);

    if (!broadcast) {
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }

    // Get recipients
    let recipientQuery = 'SELECT id, phone FROM customers WHERE 1=1';
    const params = [];

    if (broadcast.target_segment) {
      recipientQuery += ` AND tags @> $${params.length + 1}`;
      params.push([broadcast.target_segment]);
    }

    const recipients = await db.many(recipientQuery, params);

    // Send messages
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const jid = formatPhoneNumber(recipient.phone);
        await sendMessage(jid, { text: broadcast.message });
        sentCount += 1;
      } catch (error) {
        logger.error(`Failed to send to ${recipient.phone}:`, error);
        failedCount += 1;
      }
    }

    // Update broadcast status
    const updated = await db.one(
      `UPDATE broadcasts 
       SET status = 'completed', started_at = NOW(), completed_at = NOW(), 
           sent_count = $1, failed_count = $2
       WHERE id = $3 RETURNING *;`,
      [sentCount, failedCount, id],
    );

    // Emit real-time event
    global.io?.emit('broadcast:sent', {
      broadcastId: id,
      sentCount,
      failedCount,
      totalCount: recipients.length,
    });

    res.json({ success: true, data: updated, stats: { sentCount, failedCount } });
  } catch (error) {
    logger.error('Error sending broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update broadcast
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, message, targetSegment } = req.body;

    const updated = await db.one(
      `UPDATE broadcasts SET name = COALESCE($1, name), message = COALESCE($2, message), 
       target_segment = COALESCE($3, target_segment) WHERE id = $4 RETURNING *;`,
      [name, message, targetSegment, id],
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete broadcast
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.none('DELETE FROM broadcasts WHERE id = $1', [id]);

    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (error) {
    logger.error('Error deleting broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
