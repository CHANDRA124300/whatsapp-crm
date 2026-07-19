import { OpenAI } from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openaiKey });

export const generateOpenAIResponse = async (message, context = '') => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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
    });

    const reply = response.choices[0].message.content;
    logger.info('OpenAI response generated');
    return reply;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error('Failed to generate response from OpenAI');
  }
};

export const generateOpenAIResponseWithHistory = async (messages, context = '') => {
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

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 150,
    });

    const reply = response.choices[0].message.content;
    logger.info('OpenAI response generated with history');
    return reply;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error('Failed to generate response from OpenAI');
  }
};
