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
import { STATS_BLOCK_PATTERN, safeParseJson, pickNumber } from '../../../../lib/parse';
import {
  validateCompletionMessages,
  validateCompletionContentLength,
} from '../../../../lib/validation';
import { generateId, makeMessage, PROXY_USER_AGENT } from '../../../../lib/format';

const CHAT_ENDPOINT = 'https://chatjimmy.ai/api/chat';
const UPSTREAM_TIMEOUT_MS = 30_000;

function completionsCors() {
  const headers = corsHeaders('POST, OPTIONS');
  // OpenAI SDK clients send Authorization headers; allow them through CORS.
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  return headers;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: completionsCors() });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const messagesError = validateCompletionMessages(body.messages);
    if (messagesError) {
      return Response.json(
        {
          error: {
            message: messagesError,
            type: 'invalid_request_error',
            param: 'messages',
            code: null,
          },
        },
        { status: 400, headers: completionsCors() },
      );
    }

    const contentLengthError = validateCompletionContentLength(body.messages);
    if (contentLengthError) {
      return Response.json(
        {
          error: {
            message: contentLengthError,
            type: 'invalid_request_error',
            param: 'messages',
            code: null,
          },
        },
        { status: 400, headers: completionsCors() },
      );
    }

    const model = body.model || 'llama3.1-8B';
    const stream = body.stream === true;
    const topK =
      typeof body.top_k === 'number' ? body.top_k : typeof body.topK === 'number' ? body.topK : 8;

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
          'User-Agent': PROXY_USER_AGENT,
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
        {
          error: {
            message: 'Upstream connection failed',
            type: 'server_error',
            param: null,
            code: null,
          },
        },
        { status: 502, headers: completionsCors() },
      );
    }
    clearTimeout(timeout);

    if (!upstream.ok) {
      return Response.json(
        {
          error: {
            message: 'Upstream request failed',
            type: 'server_error',
            param: null,
            code: null,
          },
        },
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

    const promptTokens = pickNumber(stats, ['prefill_tokens', 'prompt_eval_count']) ?? null;
    const completionTokens = pickNumber(stats, ['decode_tokens', 'eval_count']) ?? null;
    const totalTokens =
      typeof promptTokens === 'number' && typeof completionTokens === 'number'
        ? promptTokens + completionTokens
        : (pickNumber(stats, ['total_tokens']) ?? null);

    if (stream) {
      const contentChunk = JSON.stringify({
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: { content: assistantContent },
            finish_reason: null,
          },
        ],
      });

      const finishChunk = JSON.stringify({
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
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
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: assistantContent },
            finish_reason: 'stop',
          },
        ],
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
