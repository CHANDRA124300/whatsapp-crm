import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export const generateDeepSeekResponse = async (message, context = '') => {
  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a helpful WhatsApp business assistant. ${context}`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      },
      {
        headers: {
          Authorization: `Bearer ${config.deepseekKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const reply = response.data.choices[0].message.content;
    logger.info('DeepSeek response generated');
    return reply;
  } catch (error) {
    logger.error('DeepSeek API error:', error);
    throw new Error('Failed to generate response from DeepSeek');
  }
};

export const generateDeepSeekResponseWithHistory = async (messages, context = '') => {
  try {
    const formattedMessages = [
      {
        role: 'system',
        content: `You are a helpful WhatsApp business assistant. ${context}`,
      },
      ...messages.map((msg) => ({
        role: msg.sender === 'customer' ? 'user' : 'assistant',
        content: msg.content,
      })),
    ];

    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 150,
      },
      {
        headers: {
          Authorization: `Bearer ${config.deepseekKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const reply = response.data.choices[0].message.content;
    logger.info('DeepSeek response generated with history');
    return reply;
  } catch (error) {
    logger.error('DeepSeek API error:', error);
    throw new Error('Failed to generate response from DeepSeek');
  }
};
