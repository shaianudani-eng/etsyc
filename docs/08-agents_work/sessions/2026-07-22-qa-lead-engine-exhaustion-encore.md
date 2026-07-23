---
role: qa-lead
task: engine-exhaustion-encore-qa-gate
date: 2026-07-22
tier: full
qa_verdict: PASS
branch: claude/blissful-sutherland-c2b515
commits: e25746f + 1c8e0aa
---

- **Diff:** 128 lines across anti-repetition.ts, select-videos.ts (doc-only), 2 test suites, spec §3.1, session file. Tier: Full (engine contract change).
- **Reviewers run:** code-reviewer (in-session), security-engineer (in-session), adversary-mode (in-session) — all clear; no P0/P1 findings.
- **All five scrutiny points CLEAR:**
  1. Four callers (feed, grow, browse, narration) behave correctly. FilmLayer.swapClip same-source no-op at line 477 prevents re-swap loops on WORLD_BROWSE/NARRATE_SHRINK. GROWN encore correctly promotes a clip instead of grown=null. FEED RSC encore is consistent with the existing intentional write-swallow design.
  2. Ring bounded in all paths — `selectAgainst` enforces `.slice(0, KEY_RING_MAX)` on every return, including encore. All caller limits (18, 6, 1, 1) are far below KEY_RING_MAX=50.
  3. Encore cannot widen the eligible set — `candidates` in `antiRepetition` = `rankedEligible` already intersected against `eligible(ctx)` in `selectVideos` before the call. Structurally enforced; also verified by the 25-session-ID eligibility test.
  4. FEED RSC read-only cookie path: encore fires, ring reset not persisted — consistent with existing design ("reload must not exclude clips just shown"). Server Actions persist the reset ring correctly.
  5. Spec §3.1 wording matches code conditions exactly. Test coverage is load-bearing (4 mutation kill clusters); the re-pin of `visit3.clips == []` is JUSTIFIED — it was pinning a known-bad behavior (dead surface), replaced by the correct contract (fresh lap).
- **Pre-existing flaky failures confirmed not a regression:** baseline main 11 failed/7 files, with change 5/4 — improvement, not regression, consistent with the change's fix to the exhausted-pool case.
- **P0/P1:** None.
- **P3 notes filed as tech-debt (non-blocking):**
  - No test explicitly exercises FEED RSC write-swallow + encore combo in isolation (covered implicitly by architecture).
  - `selectBrowseClip` JSDoc "null when nothing is eligible" was previously an implicit description of ring-exhaustion → null; after encore this path no longer reaches null. Comment still technically accurate but could add a parenthetical clarification.
  - visit3/visit4 structural cycle uses `passthroughRanker`; a seeded-shuffle multi-lap cycle would add robustness (current 25-session eligibility test provides adequate coverage for the eligibility invariant).
