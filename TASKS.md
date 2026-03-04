# TASKS.md — chatjimmy-proxy Task Tracker

## How This Works

- Claude checks this file before starting any session
- Mark tasks [x] with a completion date when done
- Add new tasks as they're discovered

---

## Milestone 1: Code Correctness Fixes

- [ ] Fix User-Agent version string
      Find every instance of the hardcoded string "chatjimmy-proxy/0.1.0" in User-Agent headers.
      Replace with a reference to the existing PROXY_VERSION constant.
      It should never be hardcoded again after this.

- [ ] Fix token counting sentinel value
      Find every place token counts return -1 on parse failure.
      Return null instead.
      Update the README example response under /v1/chat/completions to show null instead of -1.

- [ ] Unify error response format
      Audit all route handlers for error response shape.
      Standardize everything to { error: string }.
      HTTP status code carries the numeric signal — remove any status field from error bodies.

- [ ] Fix shell script macOS date compatibility
      In test-endpoints.sh, find date +%s%N (GNU-only, breaks on macOS BSD date).
      Replace with date +%s (seconds precision, works everywhere without dependencies).

---

## Milestone 2: Hardening (Do When Needed)

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

- [x] Confirm burst-mode streaming is intentional — benchmarked 24k byte reversal at 871ms, HC1 throughput makes buffer-and-burst correct default (2025-03)
- [x] Add CLAUDE.md, PLANNING.md, TASKS.md framework to repo (2025-03)
