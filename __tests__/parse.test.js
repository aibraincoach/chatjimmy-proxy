import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  safeParseJson,
  pickNumber,
  getCreatedTimestamp,
  getFinishReason,
  STATS_BLOCK_PATTERN,
} from '../app/lib/parse';

describe('parse utilities', () => {
  describe('safeParseJson', () => {
    it('parses valid JSON', () => {
      const result = safeParseJson('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('parses valid JSON array', () => {
      const result = safeParseJson('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('parses valid JSON string', () => {
      const result = safeParseJson('"hello"');
      expect(result).toBe('hello');
    });

    it('parses valid JSON number', () => {
      const result = safeParseJson('42');
      expect(result).toBe(42);
    });

    it('returns null for invalid JSON', () => {
      const result = safeParseJson('{invalid json}');
      expect(result).toBeNull();
    });

    it('returns null for null input', () => {
      const result = safeParseJson(null);
      expect(result).toBeNull();
    });

    it('returns null for undefined input', () => {
      const result = safeParseJson(undefined);
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = safeParseJson('');
      expect(result).toBeNull();
    });

    it('parses empty object string', () => {
      const result = safeParseJson('{}');
      expect(result).toEqual({});
    });
  });

  describe('pickNumber', () => {
    it('finds first matching numeric key', () => {
      const source = { a: 'string', b: 42, c: 100 };
      const result = pickNumber(source, ['a', 'b', 'c']);
      expect(result).toBe(42);
    });

    it('returns first numeric value when multiple match', () => {
      const source = { prefill_tokens: 100, eval_count: 50 };
      const result = pickNumber(source, ['prefill_tokens', 'eval_count']);
      expect(result).toBe(100);
    });

    it('skips non-numeric values', () => {
      const source = { a: 'string', b: null, c: 42 };
      const result = pickNumber(source, ['a', 'b', 'c']);
      expect(result).toBe(42);
    });

    it('returns null for missing keys', () => {
      const source = { a: 1, b: 2 };
      const result = pickNumber(source, ['x', 'y', 'z']);
      expect(result).toBeNull();
    });

    it('returns null for null source', () => {
      const result = pickNumber(null, ['a', 'b']);
      expect(result).toBeNull();
    });

    it('returns null for undefined source', () => {
      const result = pickNumber(undefined, ['a', 'b']);
      expect(result).toBeNull();
    });

    it('returns null for non-object source', () => {
      const result = pickNumber('string', ['a', 'b']);
      expect(result).toBeNull();
    });

    it('returns null for array source', () => {
      const result = pickNumber([1, 2, 3], ['a', 'b']);
      expect(result).toBeNull();
    });

    it('handles zero as valid number', () => {
      const source = { a: 0, b: 42 };
      const result = pickNumber(source, ['a', 'b']);
      expect(result).toBe(0);
    });

    it('handles negative numbers', () => {
      const source = { a: -50 };
      const result = pickNumber(source, ['a']);
      expect(result).toBe(-50);
    });

    it('handles float numbers', () => {
      const source = { a: 3.14159 };
      const result = pickNumber(source, ['a']);
      expect(result).toBe(3.14159);
    });
  });

  describe('getCreatedTimestamp', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('parses valid created_at string', () => {
      const stats = { created_at: '2024-01-15T10:30:00Z' };
      const result = getCreatedTimestamp(stats);
      expect(result).toBe(Math.floor(new Date('2024-01-15T10:30:00Z').getTime() / 1000));
    });

    it('returns current timestamp for missing stats', () => {
      const result = getCreatedTimestamp(null);
      expect(result).toBe(Math.floor(Date.now() / 1000));
    });

    it('returns current timestamp for missing created_at', () => {
      const stats = { other_field: 'value' };
      const result = getCreatedTimestamp(stats);
      expect(result).toBe(Math.floor(Date.now() / 1000));
    });

    it('returns current timestamp for invalid date string', () => {
      const stats = { created_at: 'invalid-date' };
      const result = getCreatedTimestamp(stats);
      expect(result).toBe(Math.floor(Date.now() / 1000));
    });

    it('returns current timestamp for non-string created_at', () => {
      const stats = { created_at: 12345 };
      const result = getCreatedTimestamp(stats);
      expect(result).toBe(Math.floor(Date.now() / 1000));
    });

    it('handles undefined stats', () => {
      const result = getCreatedTimestamp(undefined);
      expect(result).toBe(Math.floor(Date.now() / 1000));
    });

    it('converts milliseconds to seconds', () => {
      const stats = { created_at: '2024-01-15T10:30:00Z' };
      const result = getCreatedTimestamp(stats);
      // Result should be integer seconds, not milliseconds
      expect(result).toBeLessThan(Date.now() / 1000);
    });
  });

  describe('getFinishReason', () => {
    it('returns done_reason from stats', () => {
      const stats = { done_reason: 'stop' };
      const result = getFinishReason(stats);
      expect(result).toBe('stop');
    });

    it('trims whitespace from done_reason', () => {
      const stats = { done_reason: '  stop  ' };
      const result = getFinishReason(stats);
      expect(result).toBe('stop');
    });

    it('returns default "stop" for empty string', () => {
      const stats = { done_reason: '' };
      const result = getFinishReason(stats);
      expect(result).toBe('stop');
    });

    it('returns default "stop" for missing done_reason', () => {
      const stats = { other_field: 'value' };
      const result = getFinishReason(stats);
      expect(result).toBe('stop');
    });

    it('returns default "stop" for null stats', () => {
      const result = getFinishReason(null);
      expect(result).toBe('stop');
    });

    it('returns default "stop" for undefined stats', () => {
      const result = getFinishReason(undefined);
      expect(result).toBe('stop');
    });

    it('returns default "stop" for non-string done_reason', () => {
      const stats = { done_reason: 12345 };
      const result = getFinishReason(stats);
      expect(result).toBe('stop');
    });

    it('preserves custom finish reasons', () => {
      const stats = { done_reason: 'length' };
      const result = getFinishReason(stats);
      expect(result).toBe('length');
    });

    it('handles multiline whitespace in done_reason', () => {
      const stats = { done_reason: '\n  stop  \n' };
      const result = getFinishReason(stats);
      expect(result).toBe('stop');
    });
  });

  describe('STATS_BLOCK_PATTERN', () => {
    it('matches stats block with content', () => {
      const text = 'Some text<|stats|>{"key": "value"}<|/stats|>More text';
      const match = text.match(STATS_BLOCK_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('{"key": "value"}');
    });

    it('captures multiline stats content', () => {
      const text = 'Text<|stats|>{"key":\n  "value"}<|/stats|>End';
      const match = text.match(STATS_BLOCK_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toContain('\n');
    });

    it('handles no match correctly', () => {
      const text = 'No stats here';
      const match = text.match(STATS_BLOCK_PATTERN);
      expect(match).toBeNull();
    });

    it('captures minimal stats block', () => {
      const text = '<|stats|><|/stats|>';
      const match = text.match(STATS_BLOCK_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('');
    });

    it('captures complex JSON stats', () => {
      const statsJson = '{"created_at":"2024-01-15T10:30:00Z","done_reason":"stop","tokens":100}';
      const text = `Response<|stats|>${statsJson}<|/stats|>`;
      const match = text.match(STATS_BLOCK_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe(statsJson);
    });

    it('captures stats with surrounding whitespace', () => {
      const text = 'Text<|stats|>  {"key": "value"}  <|/stats|>End';
      const match = text.match(STATS_BLOCK_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('  {"key": "value"}  ');
    });

    it('only matches complete stats blocks', () => {
      const text = '<|stats|>incomplete';
      const match = text.match(STATS_BLOCK_PATTERN);
      expect(match).toBeNull();
    });

    it('is a valid regex', () => {
      expect(STATS_BLOCK_PATTERN).toBeInstanceOf(RegExp);
    });
  });
});
