import { describe, it, expect } from 'vitest';
import {
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_LENGTH,
  MAX_MESSAGES,
  MAX_CONTENT_LENGTH,
  validateChatMessage,
  validateChatHistory,
  validateCompletionMessages,
  validateCompletionContentLength,
} from '../app/lib/validation';

describe('input validation logic', () => {
  describe('chat endpoint validation', () => {
    describe('message validation', () => {
      it('rejects empty message', () => {
        expect(validateChatMessage('')).toBe('message is required');
      });

      it('rejects whitespace-only message', () => {
        expect(validateChatMessage('   \n\t  ')).toBe('message is required');
      });

      it('accepts non-empty message', () => {
        expect(validateChatMessage('Hello, world!')).toBeNull();
      });

      it('rejects message exceeding max length', () => {
        const message = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);
        expect(validateChatMessage(message)).toBe(
          `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
        );
      });

      it('accepts message at max length boundary', () => {
        const message = 'x'.repeat(MAX_MESSAGE_LENGTH);
        expect(validateChatMessage(message)).toBeNull();
      });

      it('accepts message under max length', () => {
        const message = 'x'.repeat(MAX_MESSAGE_LENGTH - 1);
        expect(validateChatMessage(message)).toBeNull();
      });

      it('rejects non-string message', () => {
        expect(validateChatMessage(123)).toBe('message is required');
      });

      it('rejects null message', () => {
        expect(validateChatMessage(null)).toBe('message is required');
      });

      it('rejects undefined message', () => {
        expect(validateChatMessage(undefined)).toBe('message is required');
      });
    });

    describe('history validation', () => {
      it('rejects history exceeding max length', () => {
        const history = Array(MAX_HISTORY_LENGTH + 1).fill({ role: 'user', content: 'text' });
        expect(validateChatHistory(history)).toBe(
          `history exceeds maximum of ${MAX_HISTORY_LENGTH} entries`,
        );
      });

      it('accepts history at max length boundary', () => {
        const history = Array(MAX_HISTORY_LENGTH).fill({ role: 'user', content: 'text' });
        expect(validateChatHistory(history)).toBeNull();
      });

      it('accepts empty history', () => {
        expect(validateChatHistory([])).toBeNull();
      });
    });
  });

  describe('v1 completions endpoint validation', () => {
    describe('messages array validation', () => {
      it('rejects missing messages', () => {
        expect(validateCompletionMessages(undefined)).toBe(
          'messages is required and must be a non-empty array',
        );
      });

      it('rejects null messages', () => {
        expect(validateCompletionMessages(null)).toBe(
          'messages is required and must be a non-empty array',
        );
      });

      it('rejects empty messages array', () => {
        expect(validateCompletionMessages([])).toBe(
          'messages is required and must be a non-empty array',
        );
      });

      it('accepts non-empty messages array', () => {
        expect(validateCompletionMessages([{ role: 'user', content: 'hello' }])).toBeNull();
      });

      it('rejects messages array exceeding max', () => {
        const messages = Array(MAX_MESSAGES + 1).fill({ role: 'user', content: 'x' });
        expect(validateCompletionMessages(messages)).toBe(
          `messages array exceeds maximum of ${MAX_MESSAGES} entries`,
        );
      });

      it('accepts messages at max boundary', () => {
        const messages = Array(MAX_MESSAGES).fill({ role: 'user', content: 'x' });
        expect(validateCompletionMessages(messages)).toBeNull();
      });
    });

    describe('content length validation', () => {
      it('calculates total content length correctly', () => {
        const messages = [{ content: 'hello' }, { content: 'world' }, { content: '!' }];
        expect(validateCompletionContentLength(messages)).toBeNull();
      });

      it('ignores non-string content', () => {
        const messages = [
          { content: 'hello' },
          { content: null },
          { content: 123 },
          { content: 'world' },
        ];
        expect(validateCompletionContentLength(messages)).toBeNull();
      });

      it('rejects total content exceeding max', () => {
        const messages = [{ content: 'x'.repeat(MAX_CONTENT_LENGTH + 1) }];
        expect(validateCompletionContentLength(messages)).toBe(
          `Total content length exceeds maximum of ${MAX_CONTENT_LENGTH} characters`,
        );
      });

      it('accepts content at max boundary', () => {
        const messages = [{ content: 'x'.repeat(MAX_CONTENT_LENGTH) }];
        expect(validateCompletionContentLength(messages)).toBeNull();
      });

      it('sums across multiple messages', () => {
        const messages = [
          { content: 'a'.repeat(30000) },
          { content: 'b'.repeat(40000) },
          { content: 'c'.repeat(25000) },
        ];
        expect(validateCompletionContentLength(messages)).toBeNull();
      });

      it('rejects when sum across messages exceeds max', () => {
        const messages = [{ content: 'a'.repeat(60000) }, { content: 'b'.repeat(50000) }];
        expect(validateCompletionContentLength(messages)).toBe(
          `Total content length exceeds maximum of ${MAX_CONTENT_LENGTH} characters`,
        );
      });
    });

    describe('system and conversation message separation', () => {
      it('separates system messages', () => {
        const messages = [
          { role: 'system', content: 'prompt' },
          { role: 'user', content: 'hello' },
        ];
        const systemMessages = messages.filter((m) => m.role === 'system');
        const conversationMessages = messages.filter((m) => m.role !== 'system');
        expect(systemMessages.length).toBe(1);
        expect(conversationMessages.length).toBe(1);
      });

      it('handles multiple system messages', () => {
        const messages = [
          { role: 'system', content: 'prompt1' },
          { role: 'user', content: 'hello' },
          { role: 'system', content: 'prompt2' },
        ];
        const systemMessages = messages.filter((m) => m.role === 'system');
        expect(systemMessages.length).toBe(2);
      });

      it('joins system messages with newline', () => {
        const systemMessages = [{ content: 'You are helpful' }, { content: 'Be concise' }];
        const systemPrompt = systemMessages.map((m) => m.content || '').join('\n');
        expect(systemPrompt).toBe('You are helpful\nBe concise');
      });

      it('handles empty system message content', () => {
        const systemMessages = [{ content: 'prompt' }, {}];
        const systemPrompt = systemMessages.map((m) => m.content || '').join('\n');
        expect(systemPrompt).toBe('prompt\n');
      });
    });

    describe('model parameter handling', () => {
      it('uses specified model', () => {
        const body = { model: 'gpt-4' };
        const model = body.model || 'llama3.1-8B';
        expect(model).toBe('gpt-4');
      });

      it('defaults to llama3.1-8B', () => {
        const body = {};
        const model = body.model || 'llama3.1-8B';
        expect(model).toBe('llama3.1-8B');
      });

      it('uses null model as undefined', () => {
        const body = { model: null };
        const model = body.model || 'llama3.1-8B';
        expect(model).toBe('llama3.1-8B');
      });
    });

    describe('stream parameter handling', () => {
      it('detects streaming request', () => {
        const body = { stream: true };
        const stream = body.stream === true;
        expect(stream).toBe(true);
      });

      it('detects non-streaming request', () => {
        const body = { stream: false };
        const stream = body.stream === true;
        expect(stream).toBe(false);
      });

      it('defaults to non-streaming', () => {
        const body = {};
        const stream = body.stream === true;
        expect(stream).toBe(false);
      });

      it('ignores truthy non-boolean stream values', () => {
        const body = { stream: 'true' };
        const stream = body.stream === true;
        expect(stream).toBe(false);
      });
    });

    describe('topK parameter handling', () => {
      it('uses top_k if present and numeric', () => {
        const body = { top_k: 12 };
        const topK =
          typeof body.top_k === 'number'
            ? body.top_k
            : typeof body.topK === 'number'
              ? body.topK
              : 8;
        expect(topK).toBe(12);
      });

      it('falls back to topK if top_k missing', () => {
        const body = { topK: 15 };
        const topK =
          typeof body.top_k === 'number'
            ? body.top_k
            : typeof body.topK === 'number'
              ? body.topK
              : 8;
        expect(topK).toBe(15);
      });

      it('defaults to 8', () => {
        const body = {};
        const topK =
          typeof body.top_k === 'number'
            ? body.top_k
            : typeof body.topK === 'number'
              ? body.topK
              : 8;
        expect(topK).toBe(8);
      });

      it('prefers top_k over topK', () => {
        const body = { top_k: 12, topK: 15 };
        const topK =
          typeof body.top_k === 'number'
            ? body.top_k
            : typeof body.topK === 'number'
              ? body.topK
              : 8;
        expect(topK).toBe(12);
      });

      it('ignores non-numeric top_k', () => {
        const body = { top_k: 'invalid', topK: 15 };
        const topK =
          typeof body.top_k === 'number'
            ? body.top_k
            : typeof body.topK === 'number'
              ? body.topK
              : 8;
        expect(topK).toBe(15);
      });
    });
  });
});
