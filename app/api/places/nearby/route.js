import { corsHeaders } from '../../../lib/cors';

const PLACES_NEARBY_ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';

// nextPageToken must be explicitly listed in X-Goog-FieldMask or it is never
// returned by the Google Places (New) API — unlike the legacy API which returned
// it automatically.
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,nextPageToken';

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders('POST, OPTIONS') });
}

export async function POST(request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Google Places API key not configured' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let upstream;
  try {
    upstream = await fetch(PLACES_NEARBY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json({ error: 'Upstream connection failed' }, { status: 502 });
  }

  const data = await upstream.json();

  if (!upstream.ok) {
    return Response.json({ error: data?.error?.message ?? 'Upstream request failed' }, {
      status: upstream.status,
      headers: corsHeaders('POST, OPTIONS'),
    });
  }

  return Response.json(data, { status: 200, headers: corsHeaders('POST, OPTIONS') });
}
