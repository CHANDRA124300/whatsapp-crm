import { makeWASocket, useMultiFileAuthState, DisconnectReason, isJidBroadcast } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import logger from '../utils/logger.js';
import config from '../config/index.js';

let sock = null;
let qrCallback = null;

export const initializeWhatsApp = async (onQRGenerated) => {
  try {
    qrCallback = onQRGenerated;
    
    const { state, saveCreds } = await useMultiFileAuthState('./store/session');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['WhatsApp CRM', 'Chrome', '120.0.0.0'],
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
    });

    // Handle QR Code
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('QR Code generated');
        if (qrCallback) {
          qrCallback(qr);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        logger.info(`Connection closed. Reconnect: ${shouldReconnect}`);
        if (shouldReconnect) {
          setTimeout(() => initializeWhatsApp(onQRGenerated), 3000);
        }
      } else if (connection === 'open') {
        logger.info('✅ WhatsApp connected successfully');
      }
    });

    // Save credentials
    sock.ev.on('creds.update', saveCreds);

    return sock;
  } catch (error) {
    logger.error('WhatsApp initialization error:', error);
    throw error;
  }
};

export const getSocket = () => sock;

export const sendMessage = async (jid, message) => {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  try {
    const sentMsg = await sock.sendMessage(jid, message);
    logger.info(`Message sent to ${jid}`);
    return sentMsg;
  } catch (error) {
    logger.error(`Error sending message to ${jid}:`, error);
    throw error;
  }
};

export const sendButtonMessage = async (jid, buttons) => {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  try {
    const message = {
      buttonsMessage: {
        contentText: buttons.contentText,
        footerText: buttons.footerText || '',
        buttons: buttons.buttons,
        headerType: 1,
      },
    };
    const sentMsg = await sock.sendMessage(jid, message);
    logger.info(`Button message sent to ${jid}`);
    return sentMsg;
  } catch (error) {
    logger.error(`Error sending button message to ${jid}:`, error);
    throw error;
  }
};

export const sendListMessage = async (jid, listMessage) => {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  try {
    const message = {
      listMessage,
    };
    const sentMsg = await sock.sendMessage(jid, message);
    logger.info(`List message sent to ${jid}`);
    return sentMsg;
  } catch (error) {
    logger.error(`Error sending list message to ${jid}:`, error);
    throw error;
  }
};

export const sendMediaMessage = async (jid, mediaUrl, type = 'image', caption = '') => {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  try {
    const message = {};
    if (type === 'image') {
      message.image = { url: mediaUrl };
    } else if (type === 'video') {
      message.video = { url: mediaUrl };
    } else if (type === 'audio') {
      message.audio = { url: mediaUrl };
    } else if (type === 'document') {
      message.document = { url: mediaUrl };
    }
    
    if (caption) {
      message.caption = caption;
    }

    const sentMsg = await sock.sendMessage(jid, message);
    logger.info(`${type} message sent to ${jid}`);
    return sentMsg;
  } catch (error) {
    logger.error(`Error sending ${type} message to ${jid}:`, error);
    throw error;
  }
};

export const sendPresenceUpdate = async (jid, type = 'typing') => {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  try {
    await sock.sendPresenceUpdate(type, jid);
    logger.info(`Presence update (${type}) sent to ${jid}`);
  } catch (error) {
    logger.error(`Error sending presence update to ${jid}:`, error);
  }
};

export const sendReadReceipt = async (jid, messageId) => {
  if (!sock) throw new Error('WhatsApp socket not initialized');
  try {
    await sock.readMessages([{ remoteJid: jid, id: messageId }]);
    logger.info(`Read receipt sent for message ${messageId}`);
  } catch (error) {
    logger.error(`Error sending read receipt:`, error);
  }
};

export const disconnectWhatsApp = async () => {
  if (sock) {
    try {
      await sock.logout();
      logger.info('WhatsApp disconnected');
    } catch (error) {
      logger.error('Error disconnecting WhatsApp:', error);
    }
  }
};
