/**
 * Formatting utilities for ChatJimmy proxy
 */

export const PROXY_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.4.0';
export const PROXY_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA || '';
export const PROXY_BUILD_TIMESTAMP = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString();
export const PROXY_USER_AGENT = `chatjimmy-proxy/${PROXY_VERSION} (educational project)`;

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
