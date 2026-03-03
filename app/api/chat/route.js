const CHAT_ENDPOINT = 'https://chatjimmy.ai/api/chat';
const STATS_BLOCK_PATTERN = /<\|stats\|>([\s\S]*?)<\|\/stats\|>/;

const PROXY_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.4.0';
const PROXY_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA || '';
const PROXY_BUILD_TIMESTAMP = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString();

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function makeMessage(role, content, indexOffset = 0) {
  const now = Date.now();
  // We generate IDs/timestamps to mimic the shape expected by ChatJimmy's backend contract.
  return {
    role,
    content,
    id: `${role}-${now}-${indexOffset}`,
    createdAt: new Date(now + indexOffset).toISOString(),
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const isJsonFormat = format === 'json';

    const body = await request.json();
    const history = Array.isArray(body.history) ? body.history : [];
    const message = typeof body.message === 'string' ? body.message : '';

    if (!message.trim()) {
      return Response.json(
        { error: 'message is required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const transformedHistory = history.map((entry, idx) =>
      makeMessage(entry.role || 'user', entry.content || '', idx),
    );

    const upstreamPayload = {
      messages: [...transformedHistory, makeMessage('user', message, transformedHistory.length + 1)],
      chatOptions: {
        selectedModel: 'llama3.1-8B',
        systemPrompt: '',
        topK: 8,
      },
      attachment: null,
    };

    const upstream = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'chatjimmy-proxy/0.1.0 (educational project)',
      },
      body: JSON.stringify(upstreamPayload),
    });

    if (isJsonFormat) {
      const upstreamText = await upstream.text();

      if (!upstream.ok) {
        return Response.json(
          {
            error: 'Upstream chat request failed',
            status: upstream.status,
            details: upstreamText || null,
          },
          { status: upstream.status, headers: corsHeaders() },
        );
      }

      const statsMatch = upstreamText.match(STATS_BLOCK_PATTERN);
      const statsRaw = statsMatch?.[1]?.trim();
      const stats = safeParseJson(statsRaw);
      const assistantContent = statsMatch
        ? upstreamText.replace(STATS_BLOCK_PATTERN, '').trim()
        : upstreamText.trim();

      const prefillTokens = pickNumber(stats, ['prefill_tokens', 'prompt_eval_count']);
      const decodeTokens = pickNumber(stats, ['decode_tokens', 'eval_count']);
      const totalTokens =
        pickNumber(stats, ['total_tokens']) ??
        (typeof prefillTokens === 'number' && typeof decodeTokens === 'number'
          ? prefillTokens + decodeTokens
          : null);
      const totalDuration = pickNumber(stats, ['total_duration']);

      const created = getCreatedTimestamp(stats);
      const finishReason = getFinishReason(stats);

      const jsonHeaders = new Headers(corsHeaders());
      jsonHeaders.set('Content-Type', 'application/json; charset=utf-8');
      jsonHeaders.set('Cache-Control', 'no-store');

      return new Response(
        JSON.stringify({
          id: crypto.randomUUID(),
          object: 'chat.completion',
          created,
          model: upstreamPayload.chatOptions.selectedModel,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: assistantContent,
              },
              finish_reason: finishReason,
            },
          ],
          usage: stats
            ? {
                prefill_tokens: prefillTokens,
                decode_tokens: decodeTokens,
                total_tokens: totalTokens,
                total_duration: totalDuration,
              }
            : null,
          proxy: {
            version: PROXY_VERSION,
            commit: PROXY_COMMIT_SHA,
            buildTimestamp: PROXY_BUILD_TIMESTAMP,
          },
        }),
        {
          status: upstream.status,
          headers: jsonHeaders,
        },
      );
    }

    if (!upstream.body) {
      return Response.json(
        { error: 'Upstream did not return a stream body' },
        { status: 502, headers: corsHeaders() },
      );
    }

    const headers = new Headers(corsHeaders());
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'no-store');

    // We pass through the raw Vercel AI SDK stream so developers can inspect exact chunk framing.
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return Response.json(
      { error: 'Proxy chat request failed', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

function safeParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pickNumber(source, keys) {
  if (!source || typeof source !== 'object') {
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

function getCreatedTimestamp(stats) {
  const createdAt = stats && typeof stats.created_at === 'string' ? Date.parse(stats.created_at) : NaN;
  if (!Number.isNaN(createdAt)) {
    return Math.floor(createdAt / 1000);
  }

  return Math.floor(Date.now() / 1000);
}

function getFinishReason(stats) {
  const doneReason = stats && typeof stats.done_reason === 'string' ? stats.done_reason.trim() : '';
  return doneReason || 'stop';
}
