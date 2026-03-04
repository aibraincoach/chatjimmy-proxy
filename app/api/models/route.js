import { corsHeaders, handleOptions } from '../../lib/cors';
import { PROXY_USER_AGENT } from '../../lib/format';

const MODELS_ENDPOINT = 'https://chatjimmy.ai/api/models';
const UPSTREAM_TIMEOUT_MS = 30_000;

export async function OPTIONS() {
  return handleOptions('GET, OPTIONS');
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(MODELS_ENDPOINT, {
        headers: {
          'User-Agent': PROXY_USER_AGENT,
        },
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return Response.json(
          { error: 'Upstream timeout' },
          { status: 504, headers: corsHeaders() },
        );
      }
      console.error('Models upstream fetch failed:', err);
      return Response.json(
        { error: 'Upstream connection failed' },
        { status: 502, headers: corsHeaders() },
      );
    }
    clearTimeout(timeout);

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error('Models upstream non-2xx:', upstream.status, errorText);
      return Response.json(
        { error: 'Upstream returned an error' },
        { status: upstream.status, headers: corsHeaders() },
      );
    }

    const data = await upstream.json();
    return Response.json(data, { status: upstream.status, headers: corsHeaders() });
  } catch (error) {
    console.error('Models proxy error:', error);
    return Response.json(
      { error: 'Internal proxy error' },
      { status: 502, headers: corsHeaders() },
    );
  }
}
