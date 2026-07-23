---
role: ai-engineer
task: engine-exhaustion-encore
date: 2026-07-22
tier: full
qa_verdict: PENDING
branch: claude/blissful-sutherland-c2b515
commit: e25746f
---

- **Problem:** stage 3 reset anti-repetition on session expiry only (§3.1 TTL/cap), not on in-session pool exhaustion. At 4 published makers the FEED's `distinct on (store_id)` yields ~4 candidates, so an engaged visitor exhausts the ring in minutes and every later selection returns empty — "You're all caught up" while eligible footage exists.
- **Decision: ADOPT.** Encore fires only on *total* exhaustion (post-ring empty AND ranked-eligible non-empty AND `limit > 0`): one re-run against an empty ring, ring written back as that lap's keys **alone**.
- **Reset, not append.** Appending onto the saturated ring leaves every later call exhausted → the ranked-first clip on repeat forever, worse than the empty it replaced. The reset makes laps cycle.
- **Consistent with spec intent, not against it:** the TTL reset already accepts "a returning buyer may see a clip again"; this takes the same trade-off on pool exhaustion instead of on the clock. Eligibility still decides correctness — the encore re-runs the *same ranked-eligible input*, so a thankyou clip cannot ride the fresh lap, and an empty *eligible* pool still returns empty (the "graceful empty" contract holds for the case it was written for).
- **In the engine, not the 4 callers** (feed/grow/browse/narration): the condition is a property of stage 3's own state; per-caller detection re-creates the triplicated-invariant problem ADR-0003 exists to prevent.
- **Contract change:** structural suite's pinned `visit3.clips == []` re-pinned to the fresh lap, plus a visit4 assertion that suppression resumes within it. 7 new/changed tests. Spec §3.1 + build checklist updated; OQ-V6 records the resolution, OQ-V4 now owns the cross-session-seen-set interaction (a persistent seen-set makes exhaustion permanent — the silent lap would then need an explicit "start over" affordance).
- **Verification:** engine suite 73 passed. Four mutants killed — encore disabled (4 tests red), append-instead-of-reset (2), `limit > 0` guard dropped (2), non-empty-candidates guard dropped (2). `tsc --noEmit` and `eslint src/lib/engine` clean.
- **Pre-existing, unrelated:** the full suite has flaky jsdom media-timing failures (5s timeouts under parallel load) in film/renderer/browse DOM tests that mock the engine out. Baseline without this change: 11 failed / 7 files; with it: 5 / 4. All pass in isolation.
