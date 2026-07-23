/**
 * PIPELINE-LEVEL STRUCTURAL SUITE (video-engine §4.3, spine §P6 acceptance).
 *
 * These tests pin the properties the composition must make impossible to
 * violate — with INJECTED FAKES for `eligible` and `ranker` (never P6a's
 * files; the EngineDeps seam is the whole point):
 *
 *  1. selection ⊆ eligible set — even against an adversarial ranker.
 *  2. a thankyou-tagged clip never survives a FEED selection.
 *  3. the ring's visit-to-visit suppression — and, once the ring holds the
 *     whole eligible pool, the exhaustion encore (§3.1): a fresh ranked lap
 *     on a reset ring, never a dead surface while eligible footage exists.
 *  4. the stateless-instance guarantee: two selectVideos invocations sharing
 *     ONLY the signed cookie still don't repeat.
 *
 * NO Math.random anywhere — the shuffling fake ranker is seeded from
 * sessionId via FNV-1a, so every run is reproducible.
 */

import { describe, expect, it } from "vitest";
import { createCookieKeyRing } from "../cookie-ring";
import { selectVideos } from "../select-videos";
import type {
  Candidate,
  EngineContext,
  KeyRing,
  KeyRingStore,
  Ranker,
  VideoProfileRow,
  VideoRow,
} from "../types";

const SECRET = "structural-suite-secret-0123456789abcdef";

function makeVideo(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    id: "vid-1",
    owner_id: "owner-1",
    store_id: "store-1",
    src: "https://cdn.example.com/vid-1.mp4",
    poster: null,
    duration_ms: 12_000,
    captions_src: null,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<VideoProfileRow> = {}): VideoProfileRow {
  return {
    id: "prof-1",
    video_id: "vid-1",
    purpose: ["craft-story"],
    page_eligibility: ["feed"],
    product_links: [],
    mood: ["calm"],
    anti_repetition_key: null,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function makeCandidate(
  videoId: string,
  overrides: { pageEligibility?: string[]; antiRepetitionKey?: string | null } = {},
): Candidate {
  return {
    videoId,
    video: makeVideo({ id: videoId, src: `https://cdn.example.com/${videoId}.mp4` }),
    profile: makeProfile({
      id: `prof-${videoId}`,
      video_id: videoId,
      page_eligibility: overrides.pageEligibility ?? ["feed"],
      anti_repetition_key: overrides.antiRepetitionKey ?? null,
    }),
    storeId: "store-1",
    ownerId: "owner-1",
    features: null,
    score: null,
  };
}

function makeCtx(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    state: "FEED",
    buyerId: null,
    sessionId: "session-1",
    storeScope: null,
    productId: null,
    moodHint: null,
    limit: 10,
    ...overrides,
  };
}

/** In-memory ring store fake — fine for a test, forbidden in production. */
function makeMemoryRing(initial: KeyRing = []): KeyRingStore {
  let ring: KeyRing = initial;
  return {
    read: () => Promise.resolve(ring),
    write: (next) => {
      ring = next;
      return Promise.resolve();
    },
  };
}

const passthroughRanker: Ranker = {
  name: "passthrough-fake",
  rank: (candidates) => Promise.resolve(candidates),
};

/** Deterministic seed — no Math.random in the engine OR its tests. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const seededShuffleRanker: Ranker = {
  name: "seeded-shuffle-fake",
  rank: (candidates, ctx) =>
    Promise.resolve(
      [...candidates].sort(
        (a, b) => fnv1a(`${ctx.sessionId}:${a.videoId}`) - fnv1a(`${ctx.sessionId}:${b.videoId}`),
      ),
    ),
};

const SESSION_IDS = Array.from({ length: 25 }, (_, i) => `session-${i}`);
const BUYER_IDS: (string | null)[] = [null, "b3b8f9e2-4c1d-4e5a-9f6b-7a8c9d0e1f2a"];

describe("selectVideos — structural suite", () => {
  it("selection is always a subset of the eligible set", async () => {
    const eligibleSet = [makeCandidate("v1"), makeCandidate("v2"), makeCandidate("v3")];
    const eligibleIds = eligibleSet.map((c) => c.videoId);
    // An adversarial ranker that tries to inject clips absent from eligible()'s
    // output — prepended, appended, and duplicated for good measure.
    const adversarialRanker: Ranker = {
      name: "adversarial-injector-fake",
      rank: (candidates) =>
        Promise.resolve([
          makeCandidate("injected-head"),
          ...candidates,
          makeCandidate("injected-tail"),
          makeCandidate("injected-head"),
        ]),
    };

    for (const sessionId of SESSION_IDS) {
      const selection = await selectVideos(makeCtx({ sessionId }), {
        eligible: () => Promise.resolve(eligibleSet),
        ranker: adversarialRanker,
        ring: makeMemoryRing(), // fresh session ring per iteration
      });
      const selectedIds = selection.clips.map((c) => c.videoId);
      expect(selectedIds).not.toContain("injected-head");
      expect(selectedIds).not.toContain("injected-tail");
      for (const id of selectedIds) {
        expect(eligibleIds).toContain(id);
      }
      expect(selectedIds.length).toBeGreaterThan(0); // it must not fix this by selecting nothing
    }
  });

  it("a thankyou-tagged clip never survives a FEED selection", async () => {
    const fixture = [
      makeCandidate("feed-clip", { pageEligibility: ["feed"] }),
      makeCandidate("thankyou-clip", { pageEligibility: ["thankyou"] }),
    ];
    // Fake `eligible` implementing the REAL FEED predicate: positive
    // page_eligibility ∋ 'feed' (spine §P6 — the locked constraint).
    const feedEligible = (_ctx: EngineContext) =>
      Promise.resolve(fixture.filter((c) => c.profile.page_eligibility.includes("feed")));

    for (const buyerId of BUYER_IDS) {
      for (const sessionId of SESSION_IDS) {
        const selection = await selectVideos(makeCtx({ sessionId, buyerId }), {
          eligible: feedEligible,
          ranker: seededShuffleRanker,
          ring: makeMemoryRing(),
        });
        const selectedIds = selection.clips.map((c) => c.videoId);
        expect(selectedIds).toContain("feed-clip");
        expect(selectedIds).not.toContain("thankyou-clip");
      }
    }
  });

  it("a ranker cannot defeat dedupe — stage 3 always runs after stage 2", async () => {
    const v1 = makeCandidate("v1");
    const v2 = makeCandidate("v2");
    // Adversarial ranker aggressively re-promotes the already-seen clip.
    const repeaterRanker: Ranker = {
      name: "repeater-fake",
      rank: (candidates) => Promise.resolve([v1, v1, v1, ...candidates]),
    };
    const selection = await selectVideos(makeCtx(), {
      eligible: () => Promise.resolve([v1, v2]),
      ranker: repeaterRanker,
      ring: makeMemoryRing(["v1"]), // v1's key is already in the session ring
    });
    const selectedIds = selection.clips.map((c) => c.videoId);
    expect(selectedIds).not.toContain("v1");
    expect(selectedIds).toEqual(["v2"]);
  });

  it("a clip selected in visit 1 is suppressed in visit 2 when the ring persists", async () => {
    const catalogue = [makeCandidate("v1"), makeCandidate("v2")];
    const ring = makeMemoryRing(); // persists across both visits
    const deps = {
      eligible: () => Promise.resolve(catalogue),
      ranker: passthroughRanker,
      ring,
    };

    const visit1 = await selectVideos(makeCtx({ limit: 1 }), deps);
    expect(visit1.clips.map((c) => c.videoId)).toEqual(["v1"]);

    const visit2 = await selectVideos(makeCtx({ limit: 1 }), deps);
    expect(visit2.clips.map((c) => c.videoId)).toEqual(["v2"]); // v1 suppressed

    // Everything seen → exhaustion encore (video-engine §3.1): a fresh lap in
    // ranked order, never a dead surface while eligible footage exists.
    const visit3 = await selectVideos(makeCtx({ limit: 1 }), deps);
    expect(visit3.clips.map((c) => c.videoId)).toEqual(["v1"]);

    // The encore RESET the ring to its own lap, so suppression works again.
    const visit4 = await selectVideos(makeCtx({ limit: 1 }), deps);
    expect(visit4.clips.map((c) => c.videoId)).toEqual(["v2"]);
  });

  it("laps cycle the whole pool under a NON-passthrough ranker — the encore is ranker-independent", async () => {
    // Launch scale: 4 published makers → ~4 FEED candidates (§3.1's premise).
    const catalogue = ["v1", "v2", "v3", "v4"].map((id) => makeCandidate(id));
    const deps = {
      eligible: () => Promise.resolve(catalogue),
      ranker: seededShuffleRanker, // NOT passthrough — order is seed-derived
      ring: makeMemoryRing(), // persists across all eight visits
    };

    const picked: string[] = [];
    for (let visit = 0; visit < 8; visit += 1) {
      const selection = await selectVideos(makeCtx({ limit: 1 }), deps);
      expect(selection.clips).toHaveLength(1); // never a dead surface
      picked.push(selection.clips[0]!.videoId);
    }

    // Two complete laps: each lap covers the pool exactly once, so within a
    // lap suppression still holds and the encore only fires at the boundary.
    const lapOne = picked.slice(0, 4);
    const lapTwo = picked.slice(4);
    expect(new Set(lapOne)).toEqual(new Set(catalogue.map((c) => c.videoId)));
    expect(new Set(lapTwo)).toEqual(new Set(catalogue.map((c) => c.videoId)));
  });

  it("a ring that cannot PERSIST (the feed's RSC write-swallow) re-serves a stable lap, never empty", async () => {
    // lib/feed/select.ts reads the ring in an RSC render but its cookie write
    // throws and is swallowed — so the ring never advances. Combined with an
    // exhausted ring this must degrade to a stable repeat, not to empty.
    const catalogue = [makeCandidate("v1"), makeCandidate("v2")];
    const saturated = ["v1", "v2"]; // as persisted earlier by a Server Action
    const nonPersistingRing: KeyRingStore = {
      read: () => Promise.resolve(saturated),
      write: () => Promise.resolve(), // the swallowed set
    };
    const deps = {
      eligible: () => Promise.resolve(catalogue),
      ranker: passthroughRanker,
      ring: nonPersistingRing,
    };

    const first = await selectVideos(makeCtx({ limit: 2 }), deps);
    const second = await selectVideos(makeCtx({ limit: 2 }), deps);

    // Encore fires on every read, and each reload shows the SAME clips —
    // which is the documented feed semantics ("a reload must not exclude the
    // clips just shown"), not a bug.
    expect(first.clips.map((c) => c.videoId)).toEqual(["v1", "v2"]);
    expect(second.clips.map((c) => c.videoId)).toEqual(["v1", "v2"]);
  });

  it("exhaustion encore stays inside the eligible set — a thankyou clip cannot ride the fresh lap", async () => {
    const fixture = [
      makeCandidate("feed-clip", { pageEligibility: ["feed"] }),
      makeCandidate("thankyou-clip", { pageEligibility: ["thankyou"] }),
    ];
    const feedEligible = (_ctx: EngineContext) =>
      Promise.resolve(fixture.filter((c) => c.profile.page_eligibility.includes("feed")));

    for (const sessionId of SESSION_IDS) {
      // The ring already holds the ONLY eligible clip → the encore must fire.
      const selection = await selectVideos(makeCtx({ sessionId }), {
        eligible: feedEligible,
        ranker: seededShuffleRanker,
        ring: makeMemoryRing(["feed-clip"]),
      });
      const selectedIds = selection.clips.map((c) => c.videoId);
      expect(selectedIds).toEqual(["feed-clip"]); // re-served, not empty
      expect(selectedIds).not.toContain("thankyou-clip"); // eligibility still wins
    }
  });

  it("anti-repetition holds across two selectVideos invocations sharing only the cookie", async () => {
    // Two SEPARATE store instances = two stateless lambdas. The only shared
    // state is the signed cookie value itself.
    let cookie: string | undefined;
    const jar = {
      read: () => cookie,
      write: (value: string) => {
        cookie = value;
      },
    };
    const catalogue = [makeCandidate("v1"), makeCandidate("v2")];
    const eligible = () => Promise.resolve(catalogue);

    const lambdaA = createCookieKeyRing({ secret: SECRET, read: jar.read, write: jar.write });
    const first = await selectVideos(makeCtx({ limit: 1 }), {
      eligible,
      ranker: passthroughRanker,
      ring: lambdaA,
    });
    expect(first.clips.map((c) => c.videoId)).toEqual(["v1"]);

    const lambdaB = createCookieKeyRing({ secret: SECRET, read: jar.read, write: jar.write });
    const second = await selectVideos(makeCtx({ limit: 1 }), {
      eligible,
      ranker: passthroughRanker,
      ring: lambdaB,
    });
    expect(second.clips.map((c) => c.videoId)).toEqual(["v2"]); // v1 travelled in the cookie
  });

  it("empty candidate set → empty Selection, gracefully, and the ring still round-trips", async () => {
    let cookie: string | undefined;
    const ring = createCookieKeyRing({
      secret: SECRET,
      read: () => cookie,
      write: (value) => {
        cookie = value;
      },
    });
    const selection = await selectVideos(makeCtx(), {
      eligible: () => Promise.resolve([]),
      ranker: seededShuffleRanker,
      ring,
    });
    expect(selection.clips).toEqual([]);
    expect(cookie).toBeDefined(); // ring written back even on empty — no short-circuit
    await expect(ring.read()).resolves.toEqual([]);
  });
});
