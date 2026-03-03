# chatjimmy-proxy

Educational Next.js 14 proxy that forwards chat calls to `https://chatjimmy.ai` and streams responses back while exposing a live in-browser network inspector.

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
- Streams raw upstream data back unchanged (`0:` token lines + metadata)

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

This educational proxy is built in collaboration with the ChatJimmy dev team. Always review and comply with service terms before production or automated usage: https://taalas.com/terms-conditions.
