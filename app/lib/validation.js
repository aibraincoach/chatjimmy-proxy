/**
 * Shared validation functions for ChatJimmy proxy endpoints
 */

export const MAX_MESSAGE_LENGTH = 25_000;
export const MAX_HISTORY_LENGTH = 50;
export const MAX_MESSAGES = 50;
export const MAX_CONTENT_LENGTH = 100_000;

/**
 * Validate a chat message string
 * @param {*} message - The message to validate
 * @returns {string|null} Error string or null if valid
 */
export function validateChatMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    return 'message is required';
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`;
  }
  return null;
}

/**
 * Validate a chat history array
 * @param {Array} history - The history array to validate
 * @returns {string|null} Error string or null if valid
 */
export function validateChatHistory(history) {
  if (history.length > MAX_HISTORY_LENGTH) {
    return `history exceeds maximum of ${MAX_HISTORY_LENGTH} entries`;
  }
  return null;
}

/**
 * Validate completion messages array
 * @param {*} messages - The messages to validate
 * @returns {string|null} Error string or null if valid
 */
export function validateCompletionMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages is required and must be a non-empty array';
  }
  if (messages.length > MAX_MESSAGES) {
    return `messages array exceeds maximum of ${MAX_MESSAGES} entries`;
  }
  return null;
}

/**
 * Validate total content length of completion messages
 * @param {Array} messages - The messages array
 * @returns {string|null} Error string or null if valid
 */
export function validateCompletionContentLength(messages) {
  let totalContentLength = 0;
  for (const msg of messages) {
    totalContentLength += typeof msg.content === 'string' ? msg.content.length : 0;
  }
  if (totalContentLength > MAX_CONTENT_LENGTH) {
    return `Total content length exceeds maximum of ${MAX_CONTENT_LENGTH} characters`;
  }
  return null;
}
