import { notFound } from "next/navigation";

import { getWorld } from "./get-world";

/**
 * The world's existence check lives HERE, and that placement is the whole
 * point of this file.
 *
 * `loading.tsx` in this segment is a Suspense boundary around `children`.
 * Everything inside it — the page, and (Next 16 streams metadata) even
 * generateMetadata — resolves AFTER the response head has gone out at 200.
 * A `notFound()` thrown from in there still renders the branded 404 body,
 * but the status is already spent: `/w/does-not-exist` answered 200 and
 * search engines indexed the 404 page as a real one.
 *
 * A layout renders OUTSIDE its own segment's loading boundary, before the
 * shell flushes, so a `notFound()` thrown here is a real 404 — while the
 * skeleton stays exactly where it was and still covers the engine read
 * behind it (§0.3 house rules; CLS 0).
 *
 * Keep the gate here. Moving it back down into the page or into
 * generateMetadata restores the soft 404 — src/app/w/[handle]/soft-404.test.ts
 * is the tripwire.
 */
export default async function WorldLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  // request-cached (get-world.ts) — the page and generateMetadata reuse this
  // exact read rather than paying for a second one
  if (!(await getWorld(handle))) notFound();
  return children;
}
