# TASKS.md — chatjimmy-proxy Task Tracker

## How This Works

- Claude checks this file before starting any session
- Mark tasks [x] with a completion date when done
- Add new tasks as they're discovered

---

## Milestone 1: Code Correctness Fixes

- [x] Fix User-Agent version string — updated README docs to reference PROXY_VERSION; code already used PROXY_USER_AGENT from format.js (2026-03-08)

- [x] Fix token counting sentinel value — code already returns null via pickNumber; README already showed null (2026-03-08)

- [x] Unify error response format — standardized health/route.js and v1/chat/completions/route.js to { error: string }; removed extra fields (proxy, latencyMs, upstreamStatus) from error bodies and flattened OpenAI-style error objects (2026-03-08)

- [x] Fix shell script macOS date compatibility — test-endpoints.sh already uses date +%s (no %N), no changes needed (2026-03-08)

---

## Milestone 2: Hardening & Documentation (Do When Needed)

- [ ] Document OpenAI API compliance gaps — usage fields return null, temperature/top_p/max_tokens accepted but ignored, stats block format undocumented and fragile, model name hardcoded. Goal: one clear section in README so integrators know what they're getting.
- [ ] Extract model name "llama3.1-8B" to a single config constant — currently in multiple files
- [ ] Validate message content structure in validateChatHistory — currently only checks array length
- [ ] Add maximum response size guard in JSON buffering mode — upstream.text() is unbounded

---

## Milestone 3: Testing (Aspirational)

- [ ] Add unit tests for parser.js — stats block extraction edge cases
- [ ] Add unit tests for validation.js — boundary conditions
- [ ] Populate **tests**/ directory (currently empty despite vitest being installed)

---

## Completed

- [x] Add copy button on completed assistant messages in chat UI (app/page.jsx) — after stream ends, clipboard + 2s “✓ Copied” feedback, silent clipboard fail (2026-03-20)
- [x] Confirm burst-mode streaming is intentional — benchmarked 24k byte reversal at 871ms, HC1 throughput makes buffer-and-burst correct default (2025-03)
- [x] Add CLAUDE.md, PLANNING.md, TASKS.md framework to repo (2025-03)
- [x] Skip SSL verification for upstream (chatjimmy.ai cert invalid) — undici Agent with rejectUnauthorized: false, centralized in app/lib/config.js (2026-03)
