import logger from '../utils/logger.js';
import { getSocket } from '../baileys/connection.js';
import { formatPhoneNumber } from '../utils/helpers.js';
import { parseVariables } from '../utils/helpers.js';

export const sendTemplateMessage = async (phone, templateContent, variables = {}) => {
  const sock = getSocket();
  if (!sock) throw new Error('Socket not initialized');
  
  try {
    const jid = formatPhoneNumber(phone);
    const parsedContent = parseVariables(templateContent, variables);
    
    const message = await sock.sendMessage(jid, { text: parsedContent });
    logger.info(`Template message sent to ${phone}`);
    return message;
  } catch (error) {
    logger.error('Error sending template message:', error);
    throw error;
  }
};

export const sendButtonResponse = async (phone, buttonData) => {
  const sock = getSocket();
  if (!sock) throw new Error('Socket not initialized');
  
  try {
    const jid = formatPhoneNumber(phone);
    
    const message = {
      text: buttonData.contentText,
      footer: buttonData.footerText,
      buttons: buttonData.buttons.map((btn) => ({
        buttonId: btn.id,
        buttonText: { displayText: btn.text },
        type: 1,
      })),
      headerType: 1,
    };
    
    const sentMessage = await sock.sendMessage(jid, message);
    logger.info(`Button message sent to ${phone}`);
    return sentMessage;
  } catch (error) {
    logger.error('Error sending button message:', error);
    throw error;
  }
};

export const sendListMessage = async (phone, listData) => {
  const sock = getSocket();
  if (!sock) throw new Error('Socket not initialized');
  
  try {
    const jid = formatPhoneNumber(phone);
    
    const message = {
      text: listData.contentText,
      footer: listData.footerText,
      title: listData.title,
      sections: listData.sections,
      buttonText: listData.buttonText || 'Select Option',
    };
    
    const sentMessage = await sock.sendMessage(jid, message);
    logger.info(`List message sent to ${phone}`);
    return sentMessage;
  } catch (error) {
    logger.error('Error sending list message:', error);
    throw error;
  }
};

export const sendCard = async (phone, cardData) => {
  const sock = getSocket();
  if (!sock) throw new Error('Socket not initialized');
  
  try {
    const jid = formatPhoneNumber(phone);
    
    let messageContent = `*${cardData.title}*\n`;
    if (cardData.description) {
      messageContent += `${cardData.description}\n`;
    }
    if (cardData.actionText && cardData.actionUrl) {
      messageContent += `\n🔗 ${cardData.actionText}: ${cardData.actionUrl}`;
    }
    
    const message = await sock.sendMessage(jid, { text: messageContent });
    logger.info(`Card message sent to ${phone}`);
    return message;
  } catch (error) {
    logger.error('Error sending card:', error);
    throw error;
  }
};

export const sendMediaWithCaption = async (phone, mediaUrl, mediaType, caption = '') => {
  const sock = getSocket();
  if (!sock) throw new Error('Socket not initialized');
  
  try {
    const jid = formatPhoneNumber(phone);
    
    const message = {};
    const messageKey = mediaType === 'document' ? 'document' : mediaType;
    message[messageKey] = { url: mediaUrl };
    
    if (caption && mediaType !== 'document') {
      message.caption = caption;
    }
    
    const sentMessage = await sock.sendMessage(jid, message);
    logger.info(`${mediaType} sent to ${phone}`);
    return sentMessage;
  } catch (error) {
    logger.error('Error sending media:', error);
    throw error;
  }
};

export const sendCannedReply = async (phone, cannedReplyText) => {
  const sock = getSocket();
  if (!sock) throw new Error('Socket not initialized');
  
  try {
    const jid = formatPhoneNumber(phone);
    const message = await sock.sendMessage(jid, { text: cannedReplyText });
    logger.info(`Canned reply sent to ${phone}`);
    return message;
  } catch (error) {
    logger.error('Error sending canned reply:', error);
    throw error;
  }
};
