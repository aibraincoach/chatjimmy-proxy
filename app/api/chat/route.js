const CHAT_ENDPOINT = 'https://chatjimmy.ai/api/chat';

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
