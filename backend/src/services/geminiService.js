import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const genAI = new GoogleGenerativeAI(config.geminiKey);

export const generateGeminiResponse = async (message, context = '') => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const systemPrompt = `You are a helpful WhatsApp business assistant. ${context}`;
    const fullPrompt = `${systemPrompt}\n\nUser: ${message}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const reply = response.text();

    logger.info('Gemini response generated');
    return reply;
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new Error('Failed to generate response from Gemini');
  }
};

export const generateGeminiResponseWithHistory = async (messages, context = '') => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const chat = model.startChat({
      history: messages
        .filter((msg) => msg.sender && msg.content)
        .map((msg) => ({
          role: msg.sender === 'customer' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })),
      generationConfig: {
        maxOutputTokens: 150,
      },
    });

    const systemPrompt = `You are a helpful WhatsApp business assistant. ${context}`;
    const result = await chat.sendMessage(systemPrompt);
    const reply = result.response.text();

    logger.info('Gemini response generated with history');
    return reply;
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new Error('Failed to generate response from Gemini');
  }
};
