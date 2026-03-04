> Repository: https://github.com/aibraincoach/chatjimmy-proxy

# chatjimmy-proxy

Educational Next.js 14 proxy that forwards chat calls to `https://chatjimmy.ai` and supports both raw streaming passthrough and normalized JSON responses while exposing a live in-browser network inspector.

## Why This Exists

WHY THIS EXISTS

ChatJimmy.ai is a demo chatbot built by Taalas (taalas.com) to showcase their HC1 chip — custom silicon that hardwires Meta's Llama 3.1 8B directly into the hardware. The result: ~17,000 tokens per second per user, roughly 10x faster than the next fastest inference provider, at a fraction of the cost and power.

But a chatbot is just a toy. The real power of sub-millisecond inference is in programmatic access — applications where microseconds matter: real-time agents, high-frequency decision loops, latency-sensitive pipelines, and any workflow where waiting 500ms for a response is a dealbreaker.

This proxy exists to unlock that power. It wraps ChatJimmy's frontend-only interface in a clean, OpenAI-compatible API so developers can build real applications on top of the fastest inference hardware in the world.

Architecture: Your app → This proxy → Taalas HC1 silicon → response in under 5ms.

## Architecture

```text
┌──────────────┐      POST /api/chat       ┌────────────────────┐      POST /api/chat       ┌──────────────────┐
│   Browser    │ ─────────────────────────▶ │   Next.js Proxy    │ ─────────────────────────▶ │  chatjimmy.ai    │
│ (UI + Logs)  │ ◀───────────────────────── │ (App Router APIs)  │ ◀───────────────────────── │  upstream API    │
└──────────────┘   streamed raw chunks      └────────────────────┘    Vercel AI stream        └──────────────────┘
```

## Endpoints

### `POST /api/chat`

Proxy chat endpoint used by the UI.

**Request body**

```json
{
  "message": "Explain recursion",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello" }
  ]
}
```

**Behavior**

- Transforms messages into ChatJimmy's expected shape (`id`, `createdAt`)
- Adds:
  - `chatOptions.selectedModel = "llama3.1-8B"`
  - `chatOptions.systemPrompt = ""`
  - `chatOptions.topK = 8`
  - `attachment = null`
- Sends request with `User-Agent: chatjimmy-proxy/0.1.0 (educational project)`
- Supports two output modes:
  - **Default streaming mode** (`POST /api/chat`): streams raw upstream data back unchanged (`0:` token lines + metadata)
  - **Normalized JSON mode** (`POST /api/chat?format=json`): buffers the full upstream response, removes `<|stats|>...<|/stats|>` metadata blocks, parses stats, and returns an OpenAI-compatible `chat.completion` JSON payload

**Streaming mode example**

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "2 + 2?",
    "history": []
  }'
```

**Normalized JSON mode example**

```bash
curl -X POST "http://localhost:3000/api/chat?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "2 + 2?",
    "history": []
  }' | jq
```

**`?format=json` response schema (example)**

```json
{
  "id": "b62d2f9f-7d5c-4ec2-a9fd-f8f5ad6ae1b1",
  "object": "chat.completion",
  "created": 1725840132,
  "model": "llama3.1-8B",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "2 + 2 = 4."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prefill_tokens": 12,
    "decode_tokens": 8,
    "total_tokens": 20,
    "total_duration": 383666667
  }
}
```

If the upstream stats block is missing, `usage` is returned as `null`.

### `GET /api/health`

Returns proxy health plus upstream data and round-trip latency.

**Response example**

```json
{
  "proxy": "ok",
  "latencyMs": 103,
  "upstreamStatus": 200,
  "upstream": {
    "status": "ok",
    "nextjs": "healthy",
    "backend": "healthy"
  }
}
```

### `POST /v1/chat/completions`

OpenAI-compatible chat completions endpoint. Any standard OpenAI SDK client can use this proxy as a drop-in backend.

> **Note:** `/api/v1/chat/completions` also works as a direct path. The `/v1/` prefix is rewritten to `/api/v1/` internally via `next.config.js` rewrites, so both paths hit the same handler.

Inspired by [for-the-zero's cj2api.ts](https://gist.github.com/for-the-zero/0a5b57f98799dfce404971f8fbb548f0) — a Cloudflare Workers proxy for ChatJimmy that implements the OpenAI format. We build on that idea with proper SSE streaming, system prompt handling, and full error handling.

**Request body**

```json
{
  "model": "llama3.1-8B",
  "messages": [
    { "role": "system", "content": "You are helpful." },
    { "role": "user", "content": "What is 2+2?" }
  ],
  "stream": false,
  "top_k": 8
}
```

- `model`: optional, defaults to `"llama3.1-8B"`
- `messages`: required, array of `{role, content}` objects
- `stream`: optional boolean, defaults to `false`
- `top_k` or `topK`: optional, defaults to `8`
- `Authorization` header: ignored (ChatJimmy has no auth — send anything or nothing)

System messages are extracted from the messages array, concatenated, and passed as `chatOptions.systemPrompt` to ChatJimmy.

**Non-streaming example**

```bash
curl -X POST "http://localhost:3000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1-8B",
    "messages": [
      {"role": "system", "content": "You are helpful."},
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'
```

**Non-streaming response**

```json
{
  "id": "chatcmpl-a1b2c3d4e5f6g7h8i9j0k1l2",
  "object": "chat.completion",
  "created": 1725840132,
  "model": "llama3.1-8B",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "2 + 2 = 4."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": null,
    "completion_tokens": null,
    "total_tokens": null
  }
}
```

**Streaming example (SSE)**

```bash
curl -N -X POST "http://localhost:3000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1-8B",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

The streaming response uses Server-Sent Events format (`Content-Type: text/event-stream`).

**Using with the Python OpenAI SDK**

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://chatjimmy-proxy-three.vercel.app/v1",
    api_key="anything"
)
response = client.chat.completions.create(
    model="llama3.1-8B",
    messages=[
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "What is 2+2?"}
    ]
)
print(response.choices[0].message.content)
```

### `GET /api/models`

Returns the upstream models payload (OpenAI-compatible list format).

## UI

The home page (`app/page.jsx`) is a split-screen interface:

- Left: chat panel with streaming assistant output
- Right: live inspector showing request payload, proxy route, raw stream lines, and final transfer stats
- Top badge shows `/api/health` status on mount

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Integration tests

```bash
# Requires: curl, jq (brew install jq)
./test-endpoints.sh                          # test production
./test-endpoints.sh http://localhost:3000     # test local dev
```

## Production build

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Keep default Next.js build settings.
4. Deploy.

No environment variables are required for the basic proxy flow.

## Disclaimer

This is an independent educational project. It is not affiliated with, endorsed by, or built in collaboration with Taalas or the ChatJimmy team. Always review and comply with service terms before production or automated usage: https://taalas.com/terms-conditions.

Contact: hello@aibrain.coach  
GitHub: [@tinhead168](https://github.com/tinhead168)
