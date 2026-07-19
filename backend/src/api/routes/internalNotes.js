import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';

const router = Router();

// Create internal note
router.post('/', async (req, res) => {
  try {
    const { conversationId, content, createdBy } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ success: false, error: 'Conversation ID and content required' });
    }

    const note = await db.one(
      `INSERT INTO internal_notes (conversation_id, content, created_by)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [conversationId, content, createdBy],
    );

    // Emit real-time event
    global.io?.emit('note:created', { conversationId, note });

    res.json({ success: true, data: note });
  } catch (error) {
    logger.error('Error creating internal note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get notes for conversation
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const notes = await db.many(
      `SELECT n.*, u.username, u.avatar_url 
       FROM internal_notes n
       JOIN users u ON n.created_by = u.id
       WHERE n.conversation_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset],
    );

    res.json({ success: true, data: notes, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching internal notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single note
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const note = await db.oneOrNone(
      `SELECT n.*, u.username FROM internal_notes n
       JOIN users u ON n.created_by = u.id
       WHERE n.id = $1`,
      [id],
    );

    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, data: note });
  } catch (error) {
    logger.error('Error fetching internal note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update internal note
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content required' });
    }

    const updated = await db.one(
      `UPDATE internal_notes SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`,
      [content, id],
    );

    // Emit real-time event
    global.io?.emit('note:updated', { noteId: id, updated });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating internal note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete internal note
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const note = await db.oneOrNone('SELECT conversation_id FROM internal_notes WHERE id = $1', [id]);

    await db.none('DELETE FROM internal_notes WHERE id = $1', [id]);

    // Emit real-time event
    global.io?.emit('note:deleted', { noteId: id, conversationId: note.conversation_id });

    res.json({ success: true, message: 'Internal note deleted' });
  } catch (error) {
    logger.error('Error deleting internal note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
