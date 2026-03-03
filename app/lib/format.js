/**
 * Formatting utilities for ChatJimmy proxy
 */

/**
 * Generate a unique ChatGPT-compatible completion ID
 * @returns {string} ID in format "chatcmpl-" + 24 hex characters
 */
export function generateId() {
  return `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

/**
 * Build a ChatJimmy message object with id and createdAt
 * @param {string} role - The message role (user, assistant, system)
 * @param {string} content - The message content
 * @param {number} indexOffset - Optional offset for id/timestamp uniqueness
 * @returns {object} ChatJimmy message object
 */
export function makeMessage(role, content, indexOffset = 0) {
  const now = Date.now();
  return {
    role,
    content,
    id: `${role}-${now}-${indexOffset}`,
    createdAt: new Date(now + indexOffset).toISOString(),
  };
}
