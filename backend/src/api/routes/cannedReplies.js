import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';

const router = Router();

// Create canned reply
router.post('/', async (req, res) => {
  try {
    const { shortcut, response, category, createdBy } = req.body;

    if (!shortcut || !response) {
      return res.status(400).json({ success: false, error: 'Shortcut and response required' });
    }

    const cannedReply = await db.one(
      `INSERT INTO canned_replies (shortcut, response, category, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [shortcut, response, category, createdBy],
    );

    res.json({ success: true, data: cannedReply });
  } catch (error) {
    logger.error('Error creating canned reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all canned replies
router.get('/', async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM canned_replies WHERE 1=1';
    const params = [];

    if (category) {
      query += ` AND category = $${params.length + 1}`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const replies = await db.many(query, params);

    res.json({ success: true, data: replies, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching canned replies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search canned replies by shortcut
router.get('/search/query', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const replies = await db.many(
      'SELECT * FROM canned_replies WHERE shortcut ILIKE $1 ORDER BY created_at DESC',
      [`%${q}%`],
    );

    res.json({ success: true, data: replies });
  } catch (error) {
    logger.error('Error searching canned replies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single canned reply
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await db.oneOrNone('SELECT * FROM canned_replies WHERE id = $1', [id]);

    if (!reply) {
      return res.status(404).json({ success: false, error: 'Canned reply not found' });
    }

    res.json({ success: true, data: reply });
  } catch (error) {
    logger.error('Error fetching canned reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update canned reply
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { shortcut, response, category } = req.body;

    const updated = await db.one(
      `UPDATE canned_replies SET shortcut = COALESCE($1, shortcut), response = COALESCE($2, response), category = COALESCE($3, category) WHERE id = $4 RETURNING *;`,
      [shortcut, response, category, id],
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating canned reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete canned reply
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.none('DELETE FROM canned_replies WHERE id = $1', [id]);

    res.json({ success: true, message: 'Canned reply deleted' });
  } catch (error) {
    logger.error('Error deleting canned reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
