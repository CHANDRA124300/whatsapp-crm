import { Router } from 'express';
import db from '../database/connection.js';
import logger from '../utils/logger.js';

const router = Router();

// Get dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const stats = await db.one(
      `SELECT 
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM conversations WHERE status = 'active') as active_conversations,
        (SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '${days} days') as messages_last_7_days,
        (SELECT COUNT(*) FROM conversations WHERE status = 'resolved' AND updated_at > NOW() - INTERVAL '${days} days') as resolved_conversations,
        (SELECT AVG(EXTRACT(EPOCH FROM (u.updated_at - m.created_at))) FROM messages m JOIN conversations c ON m.conversation_id = c.id JOIN users u ON c.assigned_to = u.id WHERE m.created_at > NOW() - INTERVAL '${days} days' AND c.assigned_to IS NOT NULL) as avg_response_time
       FROM users LIMIT 1`,
    );

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get messages analytics
router.get('/messages/analytics', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const analytics = await db.many(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_messages,
        SUM(CASE WHEN sender_type = 'agent' THEN 1 ELSE 0 END) as agent_messages,
        SUM(CASE WHEN sender_type = 'customer' THEN 1 ELSE 0 END) as customer_messages,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_messages
       FROM messages
       WHERE created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
    );

    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('Error fetching message analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get agent performance
router.get('/agents/performance', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const performance = await db.many(
      `SELECT 
        u.id,
        u.username,
        COUNT(DISTINCT c.id) as conversations_handled,
        COUNT(m.id) as messages_sent,
        SUM(CASE WHEN c.status = 'resolved' THEN 1 ELSE 0 END) as resolved_conversations,
        AVG(EXTRACT(EPOCH FROM (m.created_at - LAG(m.created_at) OVER (PARTITION BY c.id ORDER BY m.created_at)))) as avg_response_time
       FROM users u
       LEFT JOIN conversations c ON u.id = c.assigned_to AND c.updated_at > NOW() - INTERVAL '${days} days'
       LEFT JOIN messages m ON c.id = m.conversation_id AND m.sender_type = 'agent'
       WHERE u.role IN ('agent', 'manager')
       GROUP BY u.id, u.username
       ORDER BY messages_sent DESC`,
    );

    res.json({ success: true, data: performance });
  } catch (error) {
    logger.error('Error fetching agent performance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customer satisfaction
router.get('/satisfaction/score', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const satisfaction = await db.one(
      `SELECT 
        AVG(metadata->>'satisfaction_score')::FLOAT as avg_satisfaction,
        COUNT(CASE WHEN metadata->>'satisfaction_score' >= '4' THEN 1 END) as satisfied_customers,
        COUNT(CASE WHEN metadata->>'satisfaction_score' < '3' THEN 1 END) as unsatisfied_customers
       FROM conversations
       WHERE updated_at > NOW() - INTERVAL '${days} days' AND metadata->>'satisfaction_score' IS NOT NULL`,
    );

    res.json({ success: true, data: satisfaction });
  } catch (error) {
    logger.error('Error fetching satisfaction score:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get broadcast analytics
router.get('/broadcasts/analytics', async (req, res) => {
  try {
    const broadcasts = await db.many(
      `SELECT 
        id,
        name,
        status,
        recipient_count,
        sent_count,
        failed_count,
        (sent_count::FLOAT / NULLIF(recipient_count, 0) * 100)::DECIMAL(5,2) as delivery_rate,
        created_at
       FROM broadcasts
       ORDER BY created_at DESC
       LIMIT 20`,
    );

    res.json({ success: true, data: broadcasts });
  } catch (error) {
    logger.error('Error fetching broadcast analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get top contacts
router.get('/contacts/top', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topContacts = await db.many(
      `SELECT 
        c.id,
        c.name,
        c.phone,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
       FROM customers c
       LEFT JOIN conversations con ON c.id = con.customer_id
       LEFT JOIN messages m ON con.id = m.conversation_id
       GROUP BY c.id, c.name, c.phone
       ORDER BY message_count DESC
       LIMIT $1`,
      [limit],
    );

    res.json({ success: true, data: topContacts });
  } catch (error) {
    logger.error('Error fetching top contacts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
