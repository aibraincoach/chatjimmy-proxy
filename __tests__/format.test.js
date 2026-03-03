import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateId, makeMessage } from '../app/lib/format';

describe('format utilities', () => {
  describe('generateId', () => {
    it('starts with "chatcmpl-"', () => {
      const id = generateId();
      expect(id).toMatch(/^chatcmpl-/);
    });

    it('has correct total length (chatcmpl- + 24 hex chars)', () => {
      const id = generateId();
      // "chatcmpl-" = 9 chars + 24 hex chars = 33 total
      expect(id.length).toBe(33);
    });

    it('contains only hex characters after prefix', () => {
      const id = generateId();
      const hexPart = id.slice(9);
      expect(hexPart).toMatch(/^[0-9a-f]{24}$/);
    });

    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates multiple unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('uses only lowercase hex characters', () => {
      const id = generateId();
      expect(id).toMatch(/^chatcmpl-[0-9a-f]+$/);
      expect(id).not.toMatch(/[A-F]/);
    });
  });

  describe('makeMessage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns correct shape with required fields', () => {
      const msg = makeMessage('user', 'Hello');
      expect(msg).toHaveProperty('role');
      expect(msg).toHaveProperty('content');
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('createdAt');
    });

    it('sets role correctly', () => {
      const msg = makeMessage('assistant', 'Hi there');
      expect(msg.role).toBe('assistant');
    });

    it('sets content correctly', () => {
      const content = 'This is a test message';
      const msg = makeMessage('user', content);
      expect(msg.content).toBe(content);
    });

    it('generates id with role and timestamp', () => {
      const msg = makeMessage('user', 'content');
      expect(msg.id).toMatch(/^user-\d+-0$/);
    });

    it('generates ISO string createdAt', () => {
      const msg = makeMessage('user', 'content');
      expect(msg.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(msg.createdAt)).toBeInstanceOf(Date);
    });

    it('uses indexOffset in id', () => {
      const msg1 = makeMessage('user', 'content', 0);
      const msg2 = makeMessage('user', 'content', 5);
      expect(msg1.id).toMatch(/-0$/);
      expect(msg2.id).toMatch(/-5$/);
    });

    it('uses indexOffset in createdAt timestamp', () => {
      const msg1 = makeMessage('user', 'content', 0);
      const msg2 = makeMessage('user', 'content', 1000);
      const time1 = new Date(msg1.createdAt).getTime();
      const time2 = new Date(msg2.createdAt).getTime();
      expect(time2 - time1).toBe(1000);
    });

    it('handles different roles', () => {
      const userMsg = makeMessage('user', 'Hi');
      const assistantMsg = makeMessage('assistant', 'Hello');
      const systemMsg = makeMessage('system', 'You are helpful');

      expect(userMsg.role).toBe('user');
      expect(assistantMsg.role).toBe('assistant');
      expect(systemMsg.role).toBe('system');
    });

    it('handles empty content', () => {
      const msg = makeMessage('user', '');
      expect(msg.content).toBe('');
    });

    it('handles long content', () => {
      const longContent = 'x'.repeat(10000);
      const msg = makeMessage('user', longContent);
      expect(msg.content).toBe(longContent);
    });

    it('handles special characters in content', () => {
      const content = 'Hello "world" with\nnewlines\tand\x00null';
      const msg = makeMessage('user', content);
      expect(msg.content).toBe(content);
    });

    it('default indexOffset is 0', () => {
      const msg = makeMessage('user', 'content');
      expect(msg.id).toMatch(/-0$/);
    });

    it('handles large indexOffset', () => {
      const msg = makeMessage('user', 'content', 999999);
      expect(msg.id).toMatch(/-999999$/);
    });

    it('createdAt is always ISO string regardless of indexOffset', () => {
      const msg1 = makeMessage('user', 'content', 0);
      const msg2 = makeMessage('user', 'content', 50000);
      expect(msg1.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(msg2.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
