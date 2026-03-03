const HEALTH_ENDPOINT = 'https://chatjimmy.ai/api/health';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const upstream = await fetch(HEALTH_ENDPOINT, {
      headers: {
        'User-Agent': 'chatjimmy-proxy/0.1.0 (educational project)',
      },
      cache: 'no-store',
    });

    const upstreamJson = await upstream.json();
    const latencyMs = Date.now() - startedAt;

    // Health output includes both upstream and proxy context so debugging doesn't require extra calls.
    return Response.json(
      {
        proxy: 'ok',
        latencyMs,
        upstreamStatus: upstream.status,
        upstream: upstreamJson,
      },
      { status: 200, headers: corsHeaders() },
    );
  } catch (error) {
    return Response.json(
      {
        proxy: 'error',
        latencyMs: Date.now() - startedAt,
        details: error instanceof Error ? error.message : 'unknown',
      },
      { status: 502, headers: corsHeaders() },
    );
  }
}
