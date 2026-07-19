import { Router } from 'express';
import QRCode from 'qrcode';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import { generateId } from '../utils/helpers.js';

const router = Router();

// Generate QR code
router.post('/generate', async (req, res) => {
  try {
    const { customerId, campaignId, type = 'customer' } = req.body;

    const qrId = generateId();
    const qrCode = `https://wa.me/${customerId}?text=QR:${qrId}`;

    // Generate QR code image
    const qrImage = await QRCode.toDataURL(qrCode);

    // Save to database
    const qr = await db.one(
      `INSERT INTO qr_codes (code, qr_data, customer_id, campaign_id, type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [qrId, qrImage, customerId, campaignId, type],
    );

    res.json({ success: true, data: { ...qr, qrImage } });
  } catch (error) {
    logger.error('Error generating QR code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all QR codes
router.get('/', async (req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM qr_codes WHERE 1=1';
    const params = [];

    if (type) {
      query += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const qrCodes = await db.many(query, params);

    res.json({ success: true, data: qrCodes, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching QR codes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single QR code
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const qr = await db.oneOrNone('SELECT * FROM qr_codes WHERE id = $1', [id]);

    if (!qr) {
      return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    res.json({ success: true, data: qr });
  } catch (error) {
    logger.error('Error fetching QR code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track QR scan
router.post('/:code/scan', async (req, res) => {
  try {
    const { code } = req.params;

    const qr = await db.one(
      `UPDATE qr_codes 
       SET scan_count = scan_count + 1, last_scanned_at = NOW() 
       WHERE code = $1 
       RETURNING *;`,
      [code],
    );

    // Emit real-time event
    global.io?.emit('qr:scanned', {
      qrId: qr.id,
      scanCount: qr.scan_count,
      customerId: qr.customer_id,
    });

    res.json({ success: true, data: qr });
  } catch (error) {
    logger.error('Error tracking QR scan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get QR analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;

    const qr = await db.oneOrNone('SELECT * FROM qr_codes WHERE id = $1', [id]);

    if (!qr) {
      return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    const scansByDay = await db.many(
      `SELECT DATE(last_scanned_at) as date, COUNT(*) as scans
       FROM qr_codes
       WHERE id = $1 AND last_scanned_at IS NOT NULL
       GROUP BY DATE(last_scanned_at)
       ORDER BY date DESC`,
      [id],
    );

    res.json({
      success: true,
      data: {
        qr,
        totalScans: qr.scan_count,
        scansByDay,
      },
    });
  } catch (error) {
    logger.error('Error fetching QR analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete QR code
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.none('DELETE FROM qr_codes WHERE id = $1', [id]);

    res.json({ success: true, message: 'QR code deleted' });
  } catch (error) {
    logger.error('Error deleting QR code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
