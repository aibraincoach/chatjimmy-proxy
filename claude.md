# Claude Code Instructions — ChatJimmy Proxy

## Startup Protocol

1. Read this file (claude.md) to load project context
2. Read tasks.md to understand current priorities
3. Check for any open bugs in the CURRENT BUGS section of tasks.md before starting new work
4. Run `npm run build` to verify the project compiles cleanly before making changes

## Task Management

- All tasks and bugs are tracked in tasks.md
- Bug fixes take priority over new features
- Always run `npm run build` and `npm test` after changes
- Commit with clear messages referencing the task/bug fixed

## Code Standards

- Use ES modules (import/export), not CommonJS (require)
- Run `npm run lint` before committing — Prettier + ESLint enforced via CI
- No console.log in production paths — use structured logging if needed
- Keep route handlers thin; extract logic into lib/ modules
- All Supabase writes use supabaseAdmin (service role key); reads may use anon key if RLS allows

## Architecture Notes

- **chatjimmyExtract.js** — Calls ChatJimmy API to extract deals from raw HTML
- **pageFetcher.js** — Fetches and pre-processes web pages before passing to extractor
- **enrich/route.js** — Orchestrates per-page extraction loop (ChatJimmy → Gemini fallback)
- **evaluateJimmyResult()** — Gates whether ChatJimmy output is good enough to skip Gemini
- **deals/route.js** — Reads/writes deals to Supabase; uses supabaseAdmin
- **CHATJIMMY_TEXT_LIMIT** — Env var controlling max chars sent to ChatJimmy extractor

## Environment Variables

- `CHATJIMMY_API_URL` — ChatJimmy API base URL
- `CHATJIMMY_TEXT_LIMIT` — Max character limit for ChatJimmy input (currently 24,000)
- `GEMINI_API_KEY` — Google Gemini API key for fallback extraction
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps API key

---

## Session History

Sessions 1–37 archived in session-archive.md. Only active enrichment pipeline sessions retained here.

---

### Session 38: Enrichment Pipeline Debugging (Feb 28 – Mar 1, 2026)
- Diagnosed truncation issue with ChatJimmy input (CHATJIMMY_TEXT_LIMIT not propagating)
- Added per-page extraction loop to enrich/route.js
- PR #50: Initial enrichment fixes (partial — bugs 1, 3 not fully resolved)

### Session 39: Supabase Write/Read Alignment (Mar 1, 2026)
- Switched deals/route.js to supabaseAdmin to fix RLS blocking writes
- PR #51: supabaseAdmin for deals route (Bug 4 claimed fixed — persists)

### Session 40: Trace Evidence Collection (Mar 2, 2026)
- Collected full trace for Greta Bar enrichment run
- Documented: 15,292 chars on page, 4,000 chars sent to ChatJimmy, 6 deals found but not displayed
- Established evidence base for Bugs 1–5 in tasks.md

### Session 41: Evaluation Gate Analysis (Mar 3, 2026)
- Identified evaluateJimmyResult() as source of Bug 2 (too strict price validation)
- Gemini triggered unnecessarily when ChatJimmy returns deals with incomplete price fields
- Root cause documented; fix not yet implemented

### Session 42: Context Reduction Planning (Mar 3, 2026)
- Reviewed context bloat in claude.md and tasks.md
- Planned archive of Sessions 1–37 and milestone collapse
- This session implements the docs cleanup

### Session 43: Docs Cleanup (Mar 4, 2026)
- Archived Sessions 1–37 to session-archive.md
- Collapsed completed milestones (0–MVP) to one-liners in tasks.md
- Added CURRENT BUGS tracker at top of tasks.md
- Commit: "docs: archive old sessions, collapse completed milestones, add current bugs tracker"
