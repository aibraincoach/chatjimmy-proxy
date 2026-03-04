# ChatJimmy Tasks

## How to Use This File

- Work top-to-bottom: bugs first, then current milestone, then backlog
- Check a box when done: `- [x]`
- Add new discovered tasks under "Discovered Tasks" at the bottom
- Completed milestones are collapsed to one-liners to reduce context

---

## CURRENT BUGS — Fix These First

These are active, evidence-backed bugs. Trace evidence from Greta Bar enrichment (March 3, 2026).

### Bug 1: ChatJimmy input truncated before reaching extractor
- **Evidence:** Trace says `[sent 4000 chars]` despite page having 15,292 chars and CHATJIMMY_TEXT_LIMIT set to 24,000
- **Diagnosis:** The constant was raised in chatjimmyExtract.js but an upstream truncation point is still capping input before it reaches the extractor. Possibly pageFetcher, possibly website.js, possibly a stale deployment.
- **Status:** UNFIXED across PRs #50, #51

### Bug 2: evaluateJimmyResult() too strict — Gemini called unnecessarily
- **Evidence:** ChatJimmy found 6 deals. Gemini ran anyway (4.9s, 0 deals). Hierarchy says skip Gemini when ChatJimmy returns real deals.
- **Diagnosis:** evaluateJimmyResult() rejects deals with missing/empty price fields. ChatJimmy's 6 deals had descriptions but incomplete prices, so evaluation failed and triggered Gemini fallback. The hierarchy logic EXISTS but the evaluation gate is too strict.
- **Status:** UNFIXED. Not a missing feature — it's a design flaw in the evaluation criteria.

### Bug 3: Gemini receiving multi-page concatenated input
- **Evidence:** Trace says `[sent 32378 chars]` when official website alone is 15,292. Per-page architecture was built but something still accumulates pages.
- **Diagnosis:** Per-page extraction loop exists in enrich/route.js but pages may be accumulating when multiple ChatJimmy evaluations fail and fall through to Gemini.
- **Status:** UNFIXED across PRs #50, #51

### Bug 4: Deals found but not displayed in detail panel
- **Evidence:** Terminal says "Found 6 deals at Greta Bar." Detail panel says "No deals currently listed."
- **Diagnosis:** deals/route.js was switched to supabaseAdmin (PR #51) but disconnect persists. Possible causes: place_id format mismatch between write and read, RLS still blocking, race condition, or write failing silently.
- **Status:** UNFIXED across PRs #50, #51. Two claimed fixes have not resolved it.

### Bug 5: Low extraction coverage (6 of 30+ deals)
- **Evidence:** Greta Bar website has 4 specials blocks with 30+ items. ChatJimmy found only Sunday add-ons and one generic Tuesday entry.
- **Root cause:** Likely downstream of Bug 1. If ChatJimmy reads the full 15K page instead of 4K, coverage should improve dramatically. Fix Bug 1 first, then re-evaluate.
- **Status:** Blocked by Bug 1

---

## Milestone 0: Foundation & Contract — COMPLETE (2026-02-21)

## Milestone 1: Map + Search UI — COMPLETE (2026-02-22)

## Milestone 2: Scraping Layer — COMPLETE (2026-02-23)

## Milestone 3: AI Layer — COMPLETE (2026-02-25)

## Milestone 4: API Routes & Orchestration — COMPLETE (2026-02-25)

## Milestone 5: Progress Feed & Live Pins — COMPLETE (2026-02-25)

## Milestone 6: Detail Panel & Deal Cards — COMPLETE (2026-02-26)

## Milestone 6B: SEO Pages, Sitemap & Open Graph — COMPLETE (2026-02-26)

## Milestone 7: Auth, Feedback & Ratings — COMPLETE (2026-02-26)

## Milestone 8: Trust, Groups & Seed Data — COMPLETE (2026-02-27)

## Milestone MVP: Google Places API Integration — COMPLETE (2026-02-28)

---

## Milestone 9: Enrichment Pipeline Hardening

Fix the active bugs above before adding new capabilities.

- [ ] **Bug 1** — Find and remove the upstream truncation cap in pageFetcher or website.js that limits input to ~4,000 chars despite CHATJIMMY_TEXT_LIMIT=24,000
- [ ] **Bug 2** — Relax evaluateJimmyResult() to accept deals that have descriptions even if price is missing/incomplete; only reject truly empty results
- [ ] **Bug 3** — Ensure Gemini receives only the current page's content, not an accumulation of all failed pages
- [ ] **Bug 4** — Add diagnostic logging to deals/route.js write path: log place_id, deal count, and any Supabase error before returning; then trace read path to confirm place_id format matches
- [ ] **Bug 5** — After Bug 1 is fixed, re-run Greta Bar enrichment and verify coverage improves from 6 to 20+ deals
- [ ] Add integration test: mock pageFetcher to return 15K chars, assert ChatJimmy receives ≥ 14,000 chars
- [ ] Add integration test: mock ChatJimmy returning deals with missing prices, assert Gemini is NOT called

---

## Phase 2: Growth & Monetization

- [ ] User accounts and saved places
- [ ] Email digest of new deals near saved places
- [ ] Venue owner claim flow (verify ownership via email/domain)
- [ ] Venue owner deal editor (CRUD for their own deals)
- [ ] Premium tier: featured placement on map
- [ ] Analytics dashboard for venue owners (views, clicks, saves)
- [ ] Mobile app (React Native or PWA hardening)

---

## Discovered Tasks

Tasks found during implementation that don't fit current milestones.

- [ ] Investigate why Supabase place_id format differs between enrichment write and detail panel read (possible snake_case vs UUID mismatch)
- [ ] Add retry logic to enrichment pipeline: if ChatJimmy returns 0 deals on first pass, retry once with a simpler prompt
- [ ] Document CHATJIMMY_TEXT_LIMIT env var in README and .env.example
- [ ] Set up Sentry or similar error monitoring for production enrichment failures
- [ ] Add rate limiting to /api/enrich to prevent accidental runaway loops
- [ ] Create a test fixture with Greta Bar's full 15K HTML for regression testing
