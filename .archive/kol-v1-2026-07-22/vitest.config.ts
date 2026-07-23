import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // mirror tsconfig's "@/*" → "src/*" path alias
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // vitest runs in node, where the server-only guard's default export
      // throws by design (it protects client BUNDLES, not test processes).
      // Resolve it to the package's own react-server build (an empty
      // module) so lib/agents/llm.ts + lib/tagging/suggest.ts can load in
      // the eval/test rig without weakening the app's real boundary.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    // e2e/ is Playwright's — vitest owns unit tests under src/ only.
    // Component tests opt into jsdom per-file via `@vitest-environment`.
    // *.eval.ts (the LLM evals under agents/evals/) are deliberately NOT in
    // the default include: once ANTHROPIC_API_KEY exists in .env.local they
    // make live LLM calls, and `pnpm test` must stay fast, free, and
    // deterministic. Run evals explicitly via `pnpm eval`
    // (vitest.eval.config.ts).
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],

    // Worker concurrency is CAPPED, and that makes the suite both greener
    // AND faster — it is not a throughput sacrifice for determinism.
    //
    // Vitest's default forks pool runs (cores - 1) worker PROCESSES with
    // per-file isolation. Every jsdom file pays its own module-graph load,
    // and jsdom alone is ~937 CommonJS modules. Measured on the reference
    // machine, a single `require("jsdom")` costs 16-44s wall at ~0 CPU —
    // the cost is per-module resolution latency, not compute. Seven
    // workers each paying that concurrently thrash the box: the event loop
    // starves so badly that the 5s test timer fires 2-11x LATE (observed
    // test durations up to 57 381ms against a 5000ms timeout — the
    // signature of slow-but-progressing work, NOT a deadlock, which would
    // fire at ~5000ms exactly with the loop idle).
    //
    // Fewer workers keeps each process's module cache warm across the many
    // files it handles, so the expensive graph is imported a handful of
    // times instead of once per file. Full-suite measurements:
    //
    //   maxWorkers (default 7):  305s wall, 660s import, 17 tests failed
    //   maxWorkers: 2         :  171s wall,  96s import,  3 tests failed
    //   maxWorkers: 1         :  194s wall,  55s import,  3 tests failed
    //
    // 2 is the floor of that curve. Do NOT "restore parallelism" here
    // without re-measuring — raising it makes the suite slower and flaky.
    maxWorkers: 2,

    // The residual budget, sized from measurement rather than guessed.
    //
    // Every affected test PASSES in isolation (e.g. narration.test.tsx:
    // 6/6 green, 6.93s for the whole file) — nothing here hangs. But some
    // tests are honestly expensive: hero-persistence walks eight full
    // world-stage transitions, each re-rendering the whole StoreWorld tree
    // through jsdom, and a few suites wait on real timers by design
    // (useProductNarration's RETRY_DELAY_MS = 800ms; GrowProvider's
    // chained ungrow FLIP at resolveEdgeMs + 120ms; RTL waitFor budgets of
    // 2000-3000ms). On a healthy host those sum to ~1-2s; the 5s default
    // left no headroom for host variance, which is why the failing subset
    // was different on every run.
    //
    // Worst honest case under the capped pool above is 7.3s, so 20s gives
    // ~3x headroom while still failing a genuine hang in 20s rather than
    // letting it run forever.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
