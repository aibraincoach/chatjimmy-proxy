/**
 * Parsing utilities for ChatJimmy proxy
 */

export const STATS_BLOCK_PATTERN = /<\|stats\|>([\s\S]*?)<\|\/stats\|>/;

/**
 * Safely parse a JSON string, returning null on failure
 * @param {string|null|undefined} value - The value to parse
 * @returns {any|null} Parsed JSON object or null
 */
export function safeParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Pick the first numeric value from an object by key
 * @param {object|null} source - The source object
 * @param {string[]} keys - Array of keys to check in order
 * @returns {number|null} The first numeric value found or null
 */
export function pickNumber(source, keys) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number') {
      return value;
    }
  }

  return null;
}

/**
 * Extract created timestamp from stats object
 * @param {object|null} stats - The stats object
 * @returns {number} Unix timestamp in seconds, or current time if not found
 */
export function getCreatedTimestamp(stats) {
  const createdAt =
    stats && typeof stats.created_at === 'string' ? Date.parse(stats.created_at) : NaN;
  if (!Number.isNaN(createdAt)) {
    return Math.floor(createdAt / 1000);
  }

  return Math.floor(Date.now() / 1000);
}

/**
 * Extract finish reason from stats object
 * @param {object|null} stats - The stats object
 * @returns {string} The finish reason or 'stop' as default
 */
export function getFinishReason(stats) {
  const doneReason = stats && typeof stats.done_reason === 'string' ? stats.done_reason.trim() : '';
  return doneReason || 'stop';
}
