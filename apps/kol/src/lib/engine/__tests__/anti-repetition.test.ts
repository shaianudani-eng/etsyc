import { describe, expect, it } from "vitest";
import { antiRepetition } from "../anti-repetition";
import { KEY_RING_MAX, type Candidate, type VideoProfileRow, type VideoRow } from "../types";

function makeVideo(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    id: "vid-1",
    owner_id: "owner-1",
    store_id: "store-1",
    src: "https://cdn.example.com/vid-1.mp4",
    poster: "https://cdn.example.com/vid-1.jpg",
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
  overrides: { antiRepetitionKey?: string | null } = {},
): Candidate {
  return {
    videoId,
    video: makeVideo({ id: videoId, src: `https://cdn.example.com/${videoId}.mp4` }),
    profile: makeProfile({
      id: `prof-${videoId}`,
      video_id: videoId,
      anti_repetition_key: overrides.antiRepetitionKey ?? null,
    }),
    storeId: "store-1",
    ownerId: "owner-1",
    features: null,
    score: null,
  };
}

describe("antiRepetition", () => {
  it("drops a candidate whose key is already in the ring", () => {
    const candidates = [
      makeCandidate("v1", { antiRepetitionKey: "seen-key" }),
      makeCandidate("v2"),
    ];
    const { clips } = antiRepetition(candidates, ["seen-key"], 10);
    expect(clips.map((c) => c.videoId)).toEqual(["v2"]);
  });

  it("collapses within-batch duplicate keys — no two clips in one selection share a key", () => {
    // Three angles of the same wheel-throwing shot share one key → one clip.
    const candidates = [
      makeCandidate("take-1", { antiRepetitionKey: "wheel-shot" }),
      makeCandidate("take-2", { antiRepetitionKey: "wheel-shot" }),
      makeCandidate("take-3", { antiRepetitionKey: "wheel-shot" }),
      makeCandidate("other"),
    ];
    const { clips } = antiRepetition(candidates, [], 10);
    expect(clips.map((c) => c.videoId)).toEqual(["take-1", "other"]);
    const keys = clips.map((c) => c.antiRepetitionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to videoId when anti_repetition_key is null", () => {
    const candidates = [makeCandidate("v1"), makeCandidate("v2")];
    const { clips } = antiRepetition(candidates, [], 10);
    expect(clips.map((c) => c.antiRepetitionKey)).toEqual(["v1", "v2"]);
    // And a ring holding the videoId suppresses the null-key candidate next time.
    const second = antiRepetition(candidates, ["v1"], 10);
    expect(second.clips.map((c) => c.videoId)).toEqual(["v2"]);
  });

  it("truncates to limit AFTER dedupe — a dropped duplicate never consumes a slot", () => {
    const candidates = [
      makeCandidate("a", { antiRepetitionKey: "dup" }),
      makeCandidate("b", { antiRepetitionKey: "dup" }),
      makeCandidate("c"),
      makeCandidate("d"),
    ];
    const { clips } = antiRepetition(candidates, [], 2);
    expect(clips.map((c) => c.videoId)).toEqual(["a", "c"]);
  });

  it("ring grows newest-first and evicts oldest at KEY_RING_MAX", () => {
    const oldRing = Array.from({ length: KEY_RING_MAX - 1 }, (_, i) => `old-${i}`);
    const candidates = [makeCandidate("n1"), makeCandidate("n2"), makeCandidate("n3")];
    const { ring } = antiRepetition(candidates, oldRing, 10);
    expect(ring.length).toBe(KEY_RING_MAX);
    expect(ring.slice(0, 3)).toEqual(["n1", "n2", "n3"]);
    // The two oldest (deepest) keys were evicted; the rest survive.
    expect(ring).toContain("old-0");
    expect(ring).toContain(`old-${KEY_RING_MAX - 4}`);
    expect(ring).not.toContain(`old-${KEY_RING_MAX - 3}`);
    expect(ring).not.toContain(`old-${KEY_RING_MAX - 2}`);
  });

  it("empty candidate set → empty clips, ring unchanged, no throw", () => {
    const { clips, ring } = antiRepetition([], ["k1", "k2"], 5);
    expect(clips).toEqual([]);
    expect(ring).toEqual(["k1", "k2"]);
  });

  it("limit 0 selects nothing and leaves the ring unchanged", () => {
    const { clips, ring } = antiRepetition([makeCandidate("v1")], ["k1"], 0);
    expect(clips).toEqual([]);
    expect(ring).toEqual(["k1"]);
  });

  it("exhaustion encore: a ring holding every candidate key re-serves a fresh lap on a RESET ring", () => {
    const candidates = [makeCandidate("a"), makeCandidate("b"), makeCandidate("c")];
    const { clips, ring } = antiRepetition(candidates, ["a", "b", "c"], 2);
    expect(clips.map((c) => c.videoId)).toEqual(["a", "b"]); // ranked order, limit still applies
    // Ring reset to the encore lap's keys ONLY — the saturated ring is gone,
    // so within-lap suppression works again (append would exhaust forever).
    expect(ring).toEqual(["a", "b"]);
  });

  it("encore does NOT fire while any candidate survives the ring — partial stays partial", () => {
    const candidates = [makeCandidate("a"), makeCandidate("b")];
    const { clips, ring } = antiRepetition(candidates, ["a"], 10);
    expect(clips.map((c) => c.videoId)).toEqual(["b"]);
    expect(ring).toEqual(["b", "a"]); // normal prepend — no reset
  });

  it("encore still collapses within-batch duplicate keys and respects limit", () => {
    const candidates = [
      makeCandidate("take-1", { antiRepetitionKey: "wheel-shot" }),
      makeCandidate("take-2", { antiRepetitionKey: "wheel-shot" }),
      makeCandidate("other"),
    ];
    const { clips } = antiRepetition(candidates, ["wheel-shot", "other"], 10);
    expect(clips.map((c) => c.videoId)).toEqual(["take-1", "other"]);
    const keys = clips.map((c) => c.antiRepetitionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("encore never fires on an empty candidate set or limit 0 — ring passes through untouched", () => {
    const emptyPool = antiRepetition([], ["k1", "k2"], 5);
    expect(emptyPool.clips).toEqual([]);
    expect(emptyPool.ring).toEqual(["k1", "k2"]);
    // limit 0 with an exhausted ring must NOT reset the ring as a side effect.
    const limitZero = antiRepetition([makeCandidate("v1")], ["v1"], 0);
    expect(limitZero.clips).toEqual([]);
    expect(limitZero.ring).toEqual(["v1"]);
  });

  it("maps video fields onto SelectedClip", () => {
    const { clips } = antiRepetition([makeCandidate("v9")], [], 1);
    expect(clips[0]).toEqual({
      videoId: "v9",
      storeId: "store-1",
      ownerId: "owner-1",
      src: "https://cdn.example.com/v9.mp4",
      poster: "https://cdn.example.com/vid-1.jpg",
      durationMs: 12_000,
      captionsSrc: null,
      antiRepetitionKey: "v9",
    });
  });
});
