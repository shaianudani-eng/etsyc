import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The soft-404 canon.
 *
 * `/w/does-not-exist` and `/w/<unpublished>` both answered **200** in
 * production on 2026-07-23 while rendering the branded 404 body — search
 * engines index that as real content. The cause was structural, not a typo:
 * `loading.tsx` wraps the segment's children in a Suspense boundary, the
 * shell (and its status line) flushes before anything inside resolves, and
 * Next 16 streams metadata too — so `notFound()` from the page OR from
 * generateMetadata lands after the 200 is already on the wire. The control
 * case proved it: `/some-page-that-does-not-exist`, which has no loading.tsx
 * above it, returned a real 404 all along.
 *
 * The fix is placement, not deletion: the check moved up into `layout.tsx`,
 * which renders OUTSIDE its own segment's loading boundary. The skeleton is
 * untouched — it is the world's zero-CLS opening geometry (§0.3) and still
 * covers the engine's WORLD_OPEN read behind it.
 *
 * This suite is source-conformance, in the house pattern of
 * lib/feed/cookie-canon.test.ts: a runtime test cannot see the difference
 * (both shapes render the same branded body), so the SHAPE is the assertion.
 * The scan is the census, the roster is the audit list, and they must agree
 * — a future segment that adds a loading.tsx over an existence check fails
 * here rather than quietly soft-404ing in production.
 */

/** vitest runs with cwd = apps/kol (film-layer.test.tsx precedent). */
const APP_ROOT = join(process.cwd(), "src/app");
const SEGMENT = "src/app/w/[handle]";

function sourceOf(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

/** Every route file under src/app, repo-relative. */
function appFiles(): string[] {
  return readdirSync(APP_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => relative(process.cwd(), join(entry.parentPath, entry.name)));
}

/**
 * Segments whose page gates on a row it had to fetch — i.e. the ones whose
 * status code is a real answer and not a constant.
 */
function segmentsWithGatedPage(): string[] {
  return appFiles()
    .filter((file) => /(^|\/)page\.tsx$/.test(file) && /notFound\(\)/.test(sourceOf(file)))
    .map((file) => dirname(file))
    .sort();
}

/** Segments that put a Suspense boundary between the shell and the page. */
function segmentsWithLoading(): string[] {
  return appFiles()
    .filter((file) => /(^|\/)loading\.tsx$/.test(file))
    .map((file) => dirname(file))
    .sort();
}

/**
 * Known exception, listed rather than pattern-matched away.
 *
 * /seller/products/[productId] has the same shape, and its 404 is soft for
 * the same reason. It is left alone deliberately: the page interleaves
 * `notFound()` with three `redirect()` calls in an auth-then-owner-scope
 * chain, so hoisting the gate means hoisting that whole chain — a change
 * with auth semantics, not a placement fix. It is also behind sign-in, so
 * no crawler ever reaches it and no soft 404 is ever indexed. Fix it on its
 * own ticket, with its own review; delete this entry when it lands.
 */
const SOFT_404_EXEMPT = ["src/app/seller/products/[productId]"] as const;

describe("/w/[handle] — the 404 gate sits outside the loading boundary", () => {
  it("layout.tsx is the gate: it reads the world and calls notFound()", () => {
    const layout = sourceOf(`${SEGMENT}/layout.tsx`);
    expect(layout).toMatch(/import \{ notFound \} from "next\/navigation"/);
    expect(layout).toMatch(/import \{ getWorld \} from "\.\/get-world"/);
    // the gate itself — awaited world, notFound() on absence
    expect(layout, "the layout must 404 on a missing world").toMatch(
      /if \(!\(await getWorld\(handle\)\)\) notFound\(\)/,
    );
  });

  it("the skeleton stays — the fix is placement, never deleting loading.tsx", () => {
    // deleting it would also return a real 404, and would cost the world its
    // zero-CLS opening geometry: that trade is what this suite forbids
    const loading = sourceOf(`${SEGMENT}/loading.tsx`);
    expect(loading).toMatch(/export default function WorldLoading/);
    expect(loading, "the film frame's reserved aspect is the point").toMatch(/aspect-video/);
  });

  it("the world is read ONCE per request — one cached declaration, three callers", () => {
    // Three files gate on the same row. If they each declared their own
    // lookup, the layout's check would cost a second round trip on every
    // world view; `cache` only dedupes calls to the SAME function object.
    const lookup = sourceOf(`${SEGMENT}/get-world.ts`);
    expect(lookup).toMatch(/export const getWorld = cache\(/);
    expect(lookup).toMatch(/import \{ cache \} from "react"/);

    for (const caller of ["layout.tsx", "page.tsx"]) {
      const source = sourceOf(`${SEGMENT}/${caller}`);
      expect(source, `${caller} imports the shared lookup`).toMatch(
        /import \{ getWorld \} from "\.\/get-world"/,
      );
      expect(
        source.match(/from\("stores"\)/g) ?? [],
        `${caller} must not re-declare the store read`,
      ).toHaveLength(0);
    }
  });

  it("published = true is still asserted on the read — an unpublished world is a 404, not a draft leak", () => {
    const lookup = sourceOf(`${SEGMENT}/get-world.ts`);
    expect(lookup).toMatch(/\.eq\("published", true\)/);
  });
});

describe("soft-404 census — every gated page under a loading boundary", () => {
  it("a segment with loading.tsx AND a notFound() page must gate in a layout", () => {
    // The census: the intersection is the set at risk. Anything in it needs
    // a sibling layout that 404s, or an entry on the exemption roster with a
    // reason — an unlisted one fails here, not silently in production.
    const loading = new Set(segmentsWithLoading());
    const atRisk = segmentsWithGatedPage().filter((segment) => loading.has(segment));

    const ungated = atRisk.filter((segment) => {
      if ((SOFT_404_EXEMPT as readonly string[]).includes(segment)) return false;
      try {
        return !/notFound\(\)/.test(sourceOf(join(segment, "layout.tsx")));
      } catch {
        return true; // no layout at all — nothing outside the boundary can 404
      }
    });

    expect(ungated, "these segments soft-404: their notFound() runs after the 200").toEqual([]);
  });

  it("the exemption roster has no dead entries", () => {
    // an exemption that no longer describes a real segment is stale prose
    for (const segment of SOFT_404_EXEMPT) {
      expect(segmentsWithGatedPage(), `${segment} no longer gates on notFound()`).toContain(
        segment,
      );
      expect(segmentsWithLoading(), `${segment} no longer has a loading boundary`).toContain(
        segment,
      );
    }
  });
});
