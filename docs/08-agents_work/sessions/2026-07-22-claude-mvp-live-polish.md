---
date: 2026-07-22
role: solo-session (deployment handoff continuation)
task: MVP live on Shaian's own stack + production polish pass
qa_verdict: PASS (typecheck + lint clean on every push; 875 unit tests green while the box was quiet, 827 non-animation tests green after — see load caveat below; every change live-verified via Playwright against production)
---

- Deployed canonical build to etsyc.vercel.app: Shaian's own Supabase (`zmlkduvvlzfgoqzjxzzl`), 16 migrations + seeds, env via Vercel CLI, branch `deploy/canonical` on `shaianudani-eng/etsyc`.
- Landing rebuilt (stub → real front door + live maker index, ISR 300s); branded 404, favicon, OG tags + share card, robots/sitemap, security headers, theme-color.
- Fixed seed mojibake IN-DB (clipboard paste had MacRoman-corrupted 8 chars across profiles/stores/products/product_specs) — reverse `replace()` via Supabase MCP; verified zero remaining.
- Honest empty-state copy for feed ring exhaustion ("You're all caught up") — engine's exhaustion→empty contract untouched (pinned by structural suite).
- `/w/[handle]` gained a fixed "← KOL" pill (deep-linked worlds had zero exits); focus-visible added to all new interactive elements.
- Seller dead ends fixed: `/seller/products` and `/seller/clips/[videoId]` gained the breadcrumb the product editor already had.
- Alt text no longer announces "placeholder" to screen readers — stripped from `media.alt` AND `stores.config` (the copy the renderer reads), plus the seed file so a re-seed can't regress it.
- Perf, measured on production: the maker index was making Next prefetch all four world renders per landing view (store read + engine WORLD_OPEN each, 120–580ms). `prefetch={false}` on the index links; verified world prefetches 8 → 0.
- `sitemap.xml` now revalidates hourly — it was frozen at build time, so any world published after a deploy was permanently unindexable.
- SEO/chrome completed: per-world OG cards, JSON-LD (WebSite + Person), feed meta description, product-first README, changelog entry.

**Load caveat (important for the next session):** three Claude sessions ran concurrently on this box (load avg 44). The rAF/animation suites — hero-persistence, narration, browse-interact, feed-grow-seam, grow-persistence, render-store, film-layer — fail *spuriously* under that load (25 failures at peak, all passing individually; suite duration went 5.5s → 195s). Do not chase them; re-run on a quiet box before believing a failure.

**Flagged as task chips (not fixed here):**
- Ring-exhaustion product decision — should the feed serve an encore pass instead of empty?
- hero-persistence flake — genuine nondeterminism worth pinning even accounting for load.
- **Soft-404**: `/w/<missing>` and `/w/<unpublished>` render the branded 404 but return HTTP **200**. Diagnosis in the chip: the route's `loading.tsx` streaming boundary appears to flush a 200 before `notFound()` can set status (root-level 404s, which have no loading boundary, return 404 correctly).
- **Auth email is non-functional for the public** — the project still uses Supabase's built-in sender (members only, few per hour). Needs Resend SMTP; sign-in is the only auth path.
