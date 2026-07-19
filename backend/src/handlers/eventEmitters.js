import logger from '../utils/logger.js';
import { getSocket } from '../baileys/connection.js';
import { extractPhoneNumber, formatPhoneNumber } from '../utils/helpers.js';

export const initializeEventEmitters = (sock) => {
  // Handle connection update events
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      global.io?.emit('qr:generated', { qr });
    }

    if (connection === 'open') {
      global.io?.emit('whatsapp:connected', { status: 'connected' });
    }

    if (connection === 'close') {
      global.io?.emit('whatsapp:disconnected', { status: 'disconnected' });
    }
  });

  // Handle group participants
  sock.ev.on('group-participants.update', async (update) => {
    logger.info(`Group update: ${update.id}`);
  });

  // Handle contact updates
  sock.ev.on('contacts.upsert', (contacts) => {
    logger.info(`${contacts.length} contacts updated`);
  });
};

export const handleTypingIndicator = async (jid) => {
  const sock = getSocket();
  if (!sock) return;
  
  try {
    await sock.sendPresenceUpdate('typing', jid);
  } catch (error) {
    logger.error('Error sending typing indicator:', error);
  }
};

export const handleTypingPausedIndicator = async (jid) => {
  const sock = getSocket();
  if (!sock) return;
  
  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch (error) {
    logger.error('Error sending paused indicator:', error);
  }
};

export const getContactInfo = async (phone) => {
  const sock = getSocket();
  if (!sock) return null;
  
  try {
    const jid = formatPhoneNumber(phone);
    const contact = await sock.onWhatsApp(jid);
    return contact.length > 0;
  } catch (error) {
    logger.error('Error checking contact:', error);
    return false;
  }
};

export const getContactProfile = async (phone) => {
  const sock = getSocket();
  if (!sock) return null;
  
  try {
    const jid = formatPhoneNumber(phone);
    const profile = await sock.profilePictureUrl(jid, 'image');
    const status = await sock.fetchStatus(jid);
    
    return {
      phone,
      profilePicture: profile,
      status: status?.status,
    };
  } catch (error) {
    logger.error('Error fetching profile:', error);
    return null;
  }
};

export const blockContact = async (phone) => {
  const sock = getSocket();
  if (!sock) return;
  
  try {
    const jid = formatPhoneNumber(phone);
    await sock.updateBlockStatus(jid, 'block');
    logger.info(`Contact ${phone} blocked`);
  } catch (error) {
    logger.error('Error blocking contact:', error);
  }
};

export const unblockContact = async (phone) => {
  const sock = getSocket();
  if (!sock) return;
  
  try {
    const jid = formatPhoneNumber(phone);
    await sock.updateBlockStatus(jid, 'unblock');
    logger.info(`Contact ${phone} unblocked`);
  } catch (error) {
    logger.error('Error unblocking contact:', error);
  }
};
