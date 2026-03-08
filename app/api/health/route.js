import { corsHeaders, handleOptions } from '../../lib/cors';
import { PROXY_USER_AGENT } from '../../lib/format';
import { upstreamAgent } from '../../lib/config';

const HEALTH_ENDPOINT = 'https://chatjimmy.ai/api/health';
const UPSTREAM_TIMEOUT_MS = 30_000;

export async function OPTIONS() {
  return handleOptions('GET, OPTIONS');
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(HEALTH_ENDPOINT, {
        headers: {
          'User-Agent': PROXY_USER_AGENT,
        },
        cache: 'no-store',
        signal: controller.signal,
        dispatcher: upstreamAgent,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return Response.json(
          { error: 'Upstream timeout' },
          { status: 504, headers: corsHeaders() },
        );
      }
      console.error('Health upstream fetch failed:', err);
      return Response.json(
        { error: 'Upstream connection failed' },
        { status: 502, headers: corsHeaders() },
      );
    }
    clearTimeout(timeout);

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error('Health upstream non-2xx:', upstream.status, errorText);
      return Response.json(
        { error: 'Upstream returned an error' },
        { status: 502, headers: corsHeaders() },
      );
    }

    const upstreamJson = await upstream.json();
    const latencyMs = Date.now() - startedAt;

    // Health output includes both upstream and proxy context so debugging doesn't require extra calls.
    return Response.json(
      {
        proxy: 'ok',
        latencyMs,
        upstreamStatus: upstream.status,
        upstream: upstreamJson,
        endpoints: ['/api/chat', '/api/health', '/api/models', '/v1/chat/completions'],
      },
      { status: 200, headers: corsHeaders() },
    );
  } catch (error) {
    console.error('Health proxy error:', error);
    return Response.json(
      { error: 'Internal proxy error' },
      { status: 502, headers: corsHeaders() },
    );
  }
}
