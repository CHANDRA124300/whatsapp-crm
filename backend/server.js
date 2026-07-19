import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import logger from './utils/logger.js';
import config from './config/index.js';
import { initializeWhatsApp } from './baileys/connection.js';
import { initializeMessageHandlers } from './handlers/messageHandler.js';
import { initializeEventEmitters } from './handlers/eventEmitters.js';
import { processScheduledMessages } from './api/routes/scheduledMessages.js';
import { triggerWebhook } from './api/routes/webhooks.js';
import routes from './api/routes.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
  },
});

// Make io globally accessible
global.io = io;

// Middleware
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', routes);

// QR Code endpoint
let qrCode = null;
app.get('/qr', (req, res) => {
  if (qrCode) {
    res.json({ qr: qrCode });
  } else {
    res.status(404).json({ error: 'QR code not available' });
  }
});

// Socket.io events
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  // Listen for custom events
  socket.on('message:typing', (data) => {
    io.emit('user:typing', data);
  });

  socket.on('conversation:focus', (data) => {
    io.emit('conversation:focused', data);
  });
});

// Initialize WhatsApp
const initWhatsApp = async () => {
  try {
    const sock = await initializeWhatsApp((qr) => {
      qrCode = qr;
      io.emit('whatsapp:qr', { qr });
      logger.info('QR Code generated and sent to clients');
    });

    initializeMessageHandlers(sock);
    initializeEventEmitters(sock);

    logger.info('✅ WhatsApp initialized successfully');
  } catch (error) {
    logger.error('Error initializing WhatsApp:', error);
    setTimeout(initWhatsApp, 5000);
  }
};

// Start server
const startServer = async () => {
  try {
    await initWhatsApp();

    server.listen(config.port, () => {
      logger.info(`🚀 Server running on http://localhost:${config.port}`);
      logger.info(`📱 WhatsApp CRM API ready`);
      logger.info(`🔗 Frontend URL: ${config.frontendUrl}`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

startServer();
