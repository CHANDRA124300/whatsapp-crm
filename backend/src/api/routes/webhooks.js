import { Router } from 'express';
import crypto from 'crypto';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import axios from 'axios';

const router = Router();

// Create webhook
router.post('/', async (req, res) => {
  try {
    const { url, event, createdBy } = req.body;

    if (!url || !event) {
      return res.status(400).json({ success: false, error: 'URL and event required' });
    }

    const secretKey = crypto.randomBytes(32).toString('hex');

    const webhook = await db.one(
      `INSERT INTO webhooks (url, event, secret_key, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, url, event, is_active, created_at;`,
      [url, event, secretKey, createdBy],
    );

    res.json({ success: true, data: webhook });
  } catch (error) {
    logger.error('Error creating webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all webhooks
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const webhooks = await db.many(
      `SELECT id, url, event, is_active, last_triggered_at, created_at 
       FROM webhooks 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    res.json({ success: true, data: webhooks, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching webhooks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single webhook
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await db.oneOrNone(
      `SELECT id, url, event, is_active, created_at FROM webhooks WHERE id = $1`,
      [id],
    );

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    res.json({ success: true, data: webhook });
  } catch (error) {
    logger.error('Error fetching webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update webhook
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { url, event, isActive } = req.body;

    const updated = await db.one(
      `UPDATE webhooks SET url = COALESCE($1, url), event = COALESCE($2, event), is_active = COALESCE($3, is_active) WHERE id = $4 RETURNING id, url, event, is_active;`,
      [url, event, isActive, id],
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete webhook
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.none('DELETE FROM webhooks WHERE id = $1', [id]);

    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    logger.error('Error deleting webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test webhook
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await db.oneOrNone('SELECT * FROM webhooks WHERE id = $1', [id]);

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const testPayload = { event: webhook.event, test: true, timestamp: new Date() };
    const signature = crypto.createHmac('sha256', webhook.secret_key).update(JSON.stringify(testPayload)).digest('hex');

    try {
      await axios.post(webhook.url, testPayload, {
        headers: { 'X-Webhook-Signature': signature },
        timeout: 5000,
      });

      res.json({ success: true, message: 'Webhook test successful' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Webhook delivery failed', details: error.message });
    }
  } catch (error) {
    logger.error('Error testing webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger webhook
export const triggerWebhook = async (event, payload) => {
  try {
    const webhooks = await db.many('SELECT * FROM webhooks WHERE event = $1 AND is_active = TRUE', [event]);

    for (const webhook of webhooks) {
      try {
        const signature = crypto.createHmac('sha256', webhook.secret_key).update(JSON.stringify(payload)).digest('hex');

        await axios.post(webhook.url, payload, {
          headers: { 'X-Webhook-Signature': signature },
          timeout: 10000,
        });

        await db.none('UPDATE webhooks SET last_triggered_at = NOW(), retry_count = 0 WHERE id = $1', [webhook.id]);
      } catch (error) {
        logger.error(`Webhook delivery failed for ${webhook.id}:`, error.message);
        await db.none('UPDATE webhooks SET retry_count = retry_count + 1 WHERE id = $1', [webhook.id]);
      }
    }
  } catch (error) {
    logger.error('Error triggering webhooks:', error);
  }
};

export default router;
