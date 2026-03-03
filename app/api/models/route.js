const MODELS_ENDPOINT = 'https://chatjimmy.ai/api/models';

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
  try {
    const upstream = await fetch(MODELS_ENDPOINT, {
      headers: {
        'User-Agent': 'chatjimmy-proxy/0.1.0 (educational project)',
      },
      cache: 'no-store',
    });

    const data = await upstream.json();
    return Response.json(data, { status: upstream.status, headers: corsHeaders() });
  } catch (error) {
    return Response.json(
      { error: 'Failed to load models', details: error instanceof Error ? error.message : 'unknown' },
      { status: 502, headers: corsHeaders() },
    );
  }
}
