import { Router } from 'express';
import conversationRoutes from './conversations.js';
import messageRoutes from './messages.js';
import customerRoutes from './customers.js';
import templateRoutes from './templates.js';

const router = Router();

// Mount routes
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/customers', customerRoutes);
router.use('/templates', templateRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'API is running' });
});

export default router;
