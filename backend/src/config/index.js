import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  serverUrl: process.env.SERVER_URL || 'http://localhost:5000',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'whatsapp_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // AI APIs
  openaiKey: process.env.OPENAI_API_KEY,
  geminiKey: process.env.GEMINI_API_KEY,
  deepseekKey: process.env.DEEPSEEK_API_KEY,

  // WhatsApp
  whatsapp: {
    botName: process.env.WHATSAPP_BOT_NAME || 'WhatsApp CRM Bot',
    autoReplyEnabled: process.env.WHATSAPP_AUTO_REPLY_ENABLED === 'true',
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
