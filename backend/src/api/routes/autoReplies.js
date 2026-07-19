import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';

const router = Router();

// Create auto-reply rule
router.post('/', async (req, res) => {
  try {
    const { triggerKeyword, response, useAi = false, aiModel, createdBy } = req.body;

    if (!triggerKeyword || !response) {
      return res.status(400).json({ success: false, error: 'Trigger and response required' });
    }

    const autoReply = await db.one(
      `INSERT INTO auto_replies (trigger_keyword, response, use_ai, ai_model, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [triggerKeyword, response, useAi, aiModel, createdBy],
    );

    res.json({ success: true, data: autoReply });
  } catch (error) {
    logger.error('Error creating auto-reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all auto-replies
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const replies = await db.many(
      'SELECT * FROM auto_replies WHERE is_active = TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );

    res.json({ success: true, data: replies, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching auto-replies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single auto-reply
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const autoReply = await db.oneOrNone('SELECT * FROM auto_replies WHERE id = $1', [id]);

    if (!autoReply) {
      return res.status(404).json({ success: false, error: 'Auto-reply not found' });
    }

    res.json({ success: true, data: autoReply });
  } catch (error) {
    logger.error('Error fetching auto-reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update auto-reply
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { triggerKeyword, response, useAi, aiModel, isActive } = req.body;

    const updated = await db.one(
      `UPDATE auto_replies SET 
       trigger_keyword = COALESCE($1, trigger_keyword),
       response = COALESCE($2, response),
       use_ai = COALESCE($3, use_ai),
       ai_model = COALESCE($4, ai_model),
       is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *;`,
      [triggerKeyword, response, useAi, aiModel, isActive, id],
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating auto-reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete auto-reply
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.none('DELETE FROM auto_replies WHERE id = $1', [id]);

    res.json({ success: true, message: 'Auto-reply deleted' });
  } catch (error) {
    logger.error('Error deleting auto-reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
