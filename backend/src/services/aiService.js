import logger from '../utils/logger.js';
import { generateOpenAIResponse } from './openaiService.js';
import { generateGeminiResponse } from './geminiService.js';
import { generateDeepSeekResponse } from './deepseekService.js';

export const generateAIResponse = async (message, aiModel = 'gpt', context = '') => {
  try {
    let response;

    switch (aiModel.toLowerCase()) {
      case 'gpt':
      case 'openai':
        response = await generateOpenAIResponse(message, context);
        break;
      case 'gemini':
      case 'google':
        response = await generateGeminiResponse(message, context);
        break;
      case 'deepseek':
        response = await generateDeepSeekResponse(message, context);
        break;
      default:
        response = await generateOpenAIResponse(message, context);
    }

    logger.info(`AI response generated using ${aiModel}`);
    return response;
  } catch (error) {
    logger.error('AI response generation error:', error);
    throw error;
  }
};

export const generateAIResponseWithHistory = async (
  messages,
  aiModel = 'gpt',
  context = '',
) => {
  try {
    let response;

    switch (aiModel.toLowerCase()) {
      case 'gpt':
      case 'openai':
        response = await generateOpenAIResponseWithHistory(messages, context);
        break;
      case 'gemini':
      case 'google':
        response = await generateGeminiResponseWithHistory(messages, context);
        break;
      case 'deepseek':
        response = await generateDeepSeekResponseWithHistory(messages, context);
        break;
      default:
        response = await generateOpenAIResponseWithHistory(messages, context);
    }

    logger.info(`AI response generated with history using ${aiModel}`);
    return response;
  } catch (error) {
    logger.error('AI response generation error:', error);
    throw error;
  }
};
