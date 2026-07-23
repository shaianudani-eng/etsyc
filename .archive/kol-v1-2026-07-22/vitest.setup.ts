// this file has no static imports; the marker makes it a module so the
// guarded top-level `await import(...)` below is legal TypeScript
export {};

/**
 * jsdom leaves HTMLMediaElement.play/pause unimplemented (they log a
 * "not implemented" error and return undefined — `.play().catch()` would
 * throw). Real promise-returning stubs let FilmFrame's persistent playback
 * path run; the hero-persistence tests spy on these to assert the
 * never-pause invariant. No-op under the node environment.
 */
if (typeof window !== "undefined") {
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: function play(): Promise<void> {
      return Promise.resolve();
    },
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: function pause(): void {},
  });

  /**
   * Testing Library's waitFor carries its OWN budget (default 1000ms) that
   * vitest's testTimeout does not govern — a starved host blows the inner
   * budget first and surfaces it as a plain AssertionError ("expected
   * 'loading' to be 'fallback'"), which reads like a logic bug rather than
   * the timing artefact it is. That mis-signal is precisely what teaches a
   * reviewer to ignore red.
   *
   * Several suites here wait on deliberately REAL timers — the film's
   * FLIP/cross-fade backstops (edge duration + 80-120ms) and
   * useProductNarration's RETRY_DELAY_MS (800ms) — so 1000ms was never
   * more than a hair of headroom. Observed on this machine at load average
   * ~30 (8 cores): a single narration file took 145s and lost the retry
   * assertion inside a 3000ms waitFor.
   *
   * 10s absorbs that while staying an order of magnitude under the 20s
   * testTimeout, so a genuinely stuck wait still fails as a waitFor
   * timeout with its useful diagnostic rather than as a bare test timeout.
   * Dynamically imported so node-environment test files never pay for
   * loading Testing Library.
   */
  const { configure } = await import("@testing-library/dom");
  configure({ asyncUtilTimeout: 10_000 });
}
