/**
 * OpenAI-compatible /v1/chat/completions endpoint
 *
 * Inspired by for-the-zero's cj2api.ts gist:
 * https://gist.github.com/for-the-zero/0a5b57f98799dfce404971f8fbb548f0
 *
 * A Cloudflare Workers proxy for ChatJimmy that implements the OpenAI format.
 * We build on that idea with proper SSE streaming, system prompt handling,
 * and full error handling within the Next.js proxy.
 */

import { corsHeaders } from '../../../../lib/cors';

const CHAT_ENDPOINT = 'https://chatjimmy.ai/api/chat';
const STATS_BLOCK_PATTERN = /<\|stats\|>([\s\S]*?)<\|\/stats\|>/;
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 100_000;

function completionsCors() {
  const headers = corsHeaders('POST, OPTIONS');
  // OpenAI SDK clients send Authorization headers; allow them through CORS.
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  return headers;
}

function makeMessage(role, content, indexOffset = 0) {
  const now = Date.now();
  return {
    role,
    content,
    id: `${role}-${now}-${indexOffset}`,
    createdAt: new Date(now + indexOffset).toISOString(),
  };
}

function generateId() {
  return `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pickNumber(source, keys) {
  if (!source || typeof source !== 'object') return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number') return value;
  }
  return null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: completionsCors() });
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        { error: { message: 'messages is required and must be a non-empty array', type: 'invalid_request_error', param: 'messages', code: null } },
        { status: 400, headers: completionsCors() },
      );
    }

    if (body.messages.length > MAX_MESSAGES) {
      return Response.json(
        { error: { message: `messages array exceeds maximum of ${MAX_MESSAGES} entries`, type: 'invalid_request_error', param: 'messages', code: null } },
        { status: 400, headers: completionsCors() },
      );
    }

    let totalContentLength = 0;
    for (const msg of body.messages) {
      totalContentLength += typeof msg.content === 'string' ? msg.content.length : 0;
    }
    if (totalContentLength > MAX_CONTENT_LENGTH) {
      return Response.json(
        { error: { message: `Total content length exceeds maximum of ${MAX_CONTENT_LENGTH} characters`, type: 'invalid_request_error', param: 'messages', code: null } },
        { status: 400, headers: completionsCors() },
      );
    }

    const model = body.model || 'llama3.1-8B';
    const stream = body.stream === true;
    const topK = typeof body.top_k === 'number'
      ? body.top_k
      : typeof body.topK === 'number'
        ? body.topK
        : 8;

    const systemMessages = body.messages.filter((m) => m.role === 'system');
    const conversationMessages = body.messages.filter((m) => m.role !== 'system');
    const systemPrompt = systemMessages.map((m) => m.content || '').join('\n');

    const transformedMessages = conversationMessages.map((msg, idx) =>
      makeMessage(msg.role || 'user', msg.content || '', idx),
    );

    const upstreamPayload = {
      messages: transformedMessages,
      chatOptions: {
        selectedModel: model,
        systemPrompt,
        topK,
      },
      attachment: null,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'chatjimmy-proxy/0.1.0 (educational project)',
        },
        body: JSON.stringify(upstreamPayload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return Response.json(
          { error: { message: 'Upstream timeout', type: 'server_error', param: null, code: null } },
          { status: 504, headers: completionsCors() },
        );
      }
      return Response.json(
        { error: { message: 'Upstream connection failed', type: 'server_error', param: null, code: null } },
        { status: 502, headers: completionsCors() },
      );
    }
    clearTimeout(timeout);

    if (!upstream.ok) {
      return Response.json(
        { error: { message: 'Upstream request failed', type: 'server_error', param: null, code: null } },
        { status: 502, headers: completionsCors() },
      );
    }

    const upstreamText = await upstream.text();

    const statsMatch = upstreamText.match(STATS_BLOCK_PATTERN);
    const statsRaw = statsMatch?.[1]?.trim();
    const stats = safeParseJson(statsRaw);
    const assistantContent = statsMatch
      ? upstreamText.replace(STATS_BLOCK_PATTERN, '').trim()
      : upstreamText.trim();

    const completionId = generateId();
    const created = Math.floor(Date.now() / 1000);

    const promptTokens = pickNumber(stats, ['prefill_tokens', 'prompt_eval_count']) ?? -1;
    const completionTokens = pickNumber(stats, ['decode_tokens', 'eval_count']) ?? -1;
    const totalTokens =
      promptTokens >= 0 && completionTokens >= 0
        ? promptTokens + completionTokens
        : pickNumber(stats, ['total_tokens']) ?? -1;

    if (stream) {
      const contentChunk = JSON.stringify({
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { content: assistantContent },
          finish_reason: null,
        }],
      });

      const finishChunk = JSON.stringify({
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      });

      const sseBody = `data: ${contentChunk}\n\ndata: ${finishChunk}\n\ndata: [DONE]\n\n`;

      const sseHeaders = new Headers(completionsCors());
      sseHeaders.set('Content-Type', 'text/event-stream');
      sseHeaders.set('Cache-Control', 'no-store');

      return new Response(sseBody, { status: 200, headers: sseHeaders });
    }

    const jsonHeaders = new Headers(completionsCors());
    jsonHeaders.set('Content-Type', 'application/json; charset=utf-8');
    jsonHeaders.set('Cache-Control', 'no-store');

    return new Response(
      JSON.stringify({
        id: completionId,
        object: 'chat.completion',
        created,
        model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: assistantContent },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error('OpenAI completions proxy error:', error);
    return Response.json(
      { error: { message: 'Internal proxy error', type: 'server_error', param: null, code: null } },
      { status: 500, headers: completionsCors() },
    );
  }
}
