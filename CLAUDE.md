# CLAUDE.md — Session Rules for chatjimmy-proxy

## On Every New Conversation

1. Read PLANNING.md to understand architecture and constraints
2. Read TASKS.md to see what's done and what's next
3. Do not duplicate work — check tasks before starting anything
4. When you complete a task, mark it done with a date in TASKS.md
5. When you discover a new task mid-session, add it to TASKS.md immediately

## Before Ending a Session

Add a session summary block at the bottom of this file.

## Project Identity

- What it is: Educational Next.js 14 proxy wrapping ChatJimmy.ai in an OpenAI-compatible API
- What makes it interesting: Taalas HC1 chip does ~17k tokens/sec — buffer-and-burst beats real streaming in practice
- Repo: https://github.com/aibraincoach/chatjimmy-proxy
- Production: https://chatjimmy-proxy-three.vercel.app/

## Key Architectural Decisions — Do Not Reverse Without Discussion

- Burst mode is intentional: /v1/chat/completions buffers the full upstream response before sending. HC1 throughput makes this faster than streaming for real-world response lengths. Do not "fix" this.
- No auth is intentional: ChatJimmy has no auth layer. The Authorization header is ignored by design.
- CORS wildcard is intentional: Educational project. Document it, don't restrict it without a product reason.

## Code Conventions

- Error responses use { error: string } shape everywhere — HTTP status code carries the numeric signal, no status field in the body
- null for missing/invalid values, never -1 or magic numbers as error sentinels
- All env var reads go through app/lib/config.js — no process.env scattered in route handlers
- Version string comes from the PROXY_VERSION constant — never hardcoded
- Always run `npx prettier --write .` before committing — CI enforces `prettier --check` and will fail if skipped

## What We Don't Care About (Intentionally Skipped)

- Retry logic
- Structured logging / telemetry
- Separating route handler concerns into service modules
- Unit tests for every utility

---

## Session Summaries

### Session: 2025-03 — Initial Framework Setup

- Added CLAUDE.md, PLANNING.md, TASKS.md to repo root
- Identified 4 priority fixes: User-Agent version, token null, error format consistency, shell script macOS compat
- Confirmed burst-mode streaming is intentional and correct for HC1 throughput
- No code changes this session

### Session: 2026-03-20 — Assistant message copy button

- Added `getAssistantCopyText`, `isAssistantMessageComplete`, and a muted-theme Copy control under each finished assistant bubble in `app/page.jsx`
- Copy uses `navigator.clipboard.writeText` with silent no-op on missing API or failure; success shows “✓ Copied” for 2s
- Ran `npx prettier --write .` before commit
