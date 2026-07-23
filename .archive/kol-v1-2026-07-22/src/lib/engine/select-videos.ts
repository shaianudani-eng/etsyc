/**
 * The composition root — THREE PURE ORDERED STAGES (ADR-0003, video-engine §1):
 *
 *   selectVideos(ctx, deps) =
 *     antiRepetition(await deps.ranker.rank(await deps.eligible(ctx), ctx),
 *                    await deps.ring.read(), ctx.limit)
 *   then `await deps.ring.write(result.ring)`.
 *
 * Structural guarantees this function ENFORCES (video-engine §4.3), not merely
 * documents:
 *
 * 1. Eligibility encodes correctness. A ranker reorders/trims ONLY (types.ts
 *    `Ranker`): any candidate it emits that was not in stage 1's output is
 *    discarded here, so the selection is always a subset of the eligible set.
 *    A ranker can make the feed better; it can never make it wrong.
 * 2. Stage 3 runs on stage 2's OUTPUT — no ranker can bypass or defeat dedupe.
 * 3. An empty ELIGIBLE pool flows through gracefully to an empty Selection;
 *    the engine never throws on empty (callers own the fallback, e.g.
 *    NARRATE_SHRINK keeps the persistent clip playing). When the pool is
 *    non-empty but the session ring excludes all of it, stage 3 runs its
 *    exhaustion encore (anti-repetition.ts, video-engine §3.1) — the visitor
 *    starts a fresh lap instead of hitting a dead surface.
 */

import { antiRepetition } from "./anti-repetition";
import type { EngineContext, EngineDeps, Selection } from "./types";

export async function selectVideos(ctx: EngineContext, deps: EngineDeps): Promise<Selection> {
  const eligible = await deps.eligible(ctx); // stage 1 — correctness
  const ranked = await deps.ranker.rank(eligible, ctx); // stage 2 — preference

  // Guarantee 1: intersect the ranker's output with stage 1's output, so an
  // injected candidate structurally cannot reach the selection.
  const eligibleIds = new Set(eligible.map((candidate) => candidate.videoId));
  const rankedEligible = ranked.filter((candidate) => eligibleIds.has(candidate.videoId));

  const ring = await deps.ring.read();
  const result = antiRepetition(rankedEligible, ring, ctx.limit); // stage 3 — session hygiene
  await deps.ring.write(result.ring);

  return { clips: result.clips };
}
