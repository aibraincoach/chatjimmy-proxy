# PLANNING.md — chatjimmy-proxy Architecture & Vision

## What We're Building

An OpenAI-compatible proxy that wraps ChatJimmy.ai's frontend-only interface, giving developers programmatic access to Taalas HC1 inference hardware (~17k tokens/sec).

The pitch: Your app → This proxy → HC1 silicon → response faster than any GPU cloud provider's TTFT.

## Tech Stack

- Runtime: Next.js 14 App Router (Node.js on Vercel)
- Language: JavaScript (no TypeScript)
- Deploy: Vercel (zero-config, no env vars required for basic flow)
- Tests: Shell integration tests (test-endpoints.sh) + Vitest for units (aspirational)
- Formatting: Prettier

## Endpoints

- POST /api/chat — Internal UI endpoint, raw stream passthrough or ?format=json
- POST /v1/chat/completions — OpenAI-compatible, main external API surface
- GET /api/health — Proxy + upstream health check with latency
- GET /api/models — OpenAI-compatible models list

Both /v1/chat/completions and /api/v1/chat/completions work (rewritten via next.config.js).

## Key Files

app/
api/
chat/route.js
health/route.js
models/route.js
v1/chat/completions/route.js
lib/
config.js — ALL env vars and constants live here
validation.js — Input validation utilities
parser.js — Stats block extraction, response formatting
page.jsx — Split-screen UI
CLAUDE.md
PLANNING.md
TASKS.md
test-endpoints.sh

## Upstream API Shape (ChatJimmy)

ChatJimmy expects:
{
"messages": [{ "id": "uuid", "role": "user", "content": "...", "createdAt": "ISO8601" }],
"chatOptions": { "selectedModel": "llama3.1-8B", "systemPrompt": "", "topK": 8 },
"attachment": null
}
Returns Vercel AI SDK stream format: 0:"token" lines, followed by a <|stats|>...<|/stats|> metadata block.

## Deliberate Design Constraints

- Burst mode: Buffer full upstream response, send as one chunk. Faster than streaming at HC1 speeds. Confirmed correct after benchmarking.
- No auth: ChatJimmy has no auth. Documented clearly.
- Public repo: No secrets, no proprietary logic. Private notes live in a separate private repo.

## Known Upstream Fragility

- Stats block format (<|stats|>...<|/stats|>) is undocumented and could change
- Model name "llama3.1-8B" appears in multiple places — tracked in TASKS
