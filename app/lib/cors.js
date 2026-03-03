export function corsHeaders(methods = 'GET, OPTIONS') {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function handleOptions(methods) {
  return new Response(null, { status: 204, headers: corsHeaders(methods) });
}
