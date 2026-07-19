import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

export const generateId = () => uuidv4();

export const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Add @s.whatsapp.net for WhatsApp
  return `${cleaned}@s.whatsapp.net`;
};

export const extractPhoneNumber = (jid) => {
  return jid.split('@')[0];
};

export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment(date).format(format);
};

export const parseVariables = (template, variables = {}) => {
  let result = template;
  Object.keys(variables).forEach((key) => {
    result = result.replace(`{{${key}}}`, variables[key]);
  });
  return result;
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const truncateString = (str, length = 50) => {
  return str.length > length ? str.substring(0, length) + '...' : str;
};
