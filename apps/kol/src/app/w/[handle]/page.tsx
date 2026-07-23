import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { createEngineDeps, selectVideos } from "@/lib/engine";
import { FEED_RING_COOKIE, ringCookieOptions } from "@/lib/feed/select";
import { FEED_SESSION_COOKIE, resolveFeedSessionId } from "@/lib/feed/session";
import { renderStore } from "@/lib/renderer/render-store";
import { validateStoreConfig } from "@/lib/store-config/schema";
import type { StoreConfig } from "@/lib/store-config/types";
import { createClient } from "@/lib/supabase/server";

/**
 * /w/[handle] — a maker's world, deep-linkable (spec B3 / E5 ruling: a
 * buyer arriving cold, with no feed pass, still gets the full world and
 * can name the person whose world they are standing in).
 *
 * Public route (lib/auth/routes.ts: everything unclaimed is public); RLS
 * is the read boundary and `published = true` is asserted here as well so
 * an unpublished world is a 404, never a leaked draft.
 *
 * The engine and the renderer meet ONLY at videos.id: selectVideos
 * (WORLD_OPEN, store scope, limit 1) picks the store's signature clip for
 * the persistent single-clip slot, and the renderer pins it via
 * media.clips[].id ≡ videos.id. The engine never reads blocks or
 * stores.config; the renderer never reads the canonical video tables.
 */

const getWorld = cache(
  async (
    handle: string,
  ): Promise<{ storeId: string; name: string; config: StoreConfig } | null> => {
    const supabase = await createClient();
    const { data: store } = await supabase
      .from("stores")
      .select("id, name, config")
      .eq("handle", handle)
      .eq("published", true)
      .maybeSingle();
    if (!store) return null;

    // Stored configs were validated at write time (P3); a row that fails
    // now is corrupt data, not a render case — degrade to 404 rather than
    // an unstyled or broken world.
    const parsed = validateStoreConfig(store.config);
    if (!parsed.ok) {
      console.warn(`[w/${handle}] stored config failed validation — serving 404`, parsed.errors);
      return null;
    }
    return { storeId: store.id, name: store.name, config: parsed.config };
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const world = await getWorld(handle);
  // 404 here, not only in the page: metadata resolves BEFORE streaming
  // starts, so the status code is still settable (the loading.tsx boundary
  // means a notFound() thrown mid-stream would arrive after a 200).
  if (!world) notFound();
  return {
    title: `${world.config.maker.displayName} — ${world.name} · KOL`,
    description: world.config.maker.bio,
  };
}

/**
 * The engine's WORLD_OPEN read. Isolated so ANY failure — missing secret,
 * DB hiccup, empty selection — degrades to `undefined` and the world still
 * opens on the seller's own binding order: a failure never blocks the film.
 */
async function selectSignatureClipId(storeId: string): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    // ONE ring cookie across every buyer surface (B1a canonical name,
    // DECISIONS.md) — feed history counts against this selection and vice
    // versa. Best-effort write: Server Components cannot persist cookies
    // (same posture as lib/supabase/server.ts / getFeedSelection); the
    // intended ring WRITER is B4's server action, not this read.
    const deps = createEngineDeps({
      read: () => cookieStore.get(FEED_RING_COOKIE)?.value,
      write: (value: string) => {
        try {
          // the canonical attribute set — imported, never re-typed (DECISIONS)
          cookieStore.set(FEED_RING_COOKIE, value, ringCookieOptions());
        } catch {
          // read-only cookie store during RSC render — deliberate, not a gap
        }
      },
    });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const selection = await selectVideos(
      {
        state: "WORLD_OPEN",
        buyerId: user?.id ?? null,
        // The proxy middleware is the SOLE minter of kol_sid;
        // resolveFeedSessionId only validates (fresh anonymous id for this
        // request when absent/tampered — the proxy re-mints on response).
        // Stable session ⇒ stable seeded jitter across reloads.
        sessionId: resolveFeedSessionId(cookieStore.get(FEED_SESSION_COOKIE)?.value),
        storeScope: storeId,
        productId: null,
        moodHint: null,
        limit: 1,
      },
      deps,
    );
    return selection.clips[0]?.videoId;
  } catch (error) {
    console.warn("[w] engine WORLD_OPEN read failed — world opens unpinned", error);
    return undefined;
  }
}

export default async function WorldPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const world = await getWorld(handle);
  if (!world) notFound();

  const pinnedClipId = await selectSignatureClipId(world.storeId);

  // world-open: the unfold is this surface; scrolling advances toward
  // WORLD_BROWSE — that stage change is B4's (StoreWorld's stage machinery
  // is the handoff point), not built here.
  return (
    <>
      {/* Quiet way home for cold arrivals (E5: deep-linked worlds are a
          full surface — without this, a visitor from a shared link or the
          sitemap has no path to the rest of KOL). Sits above the docked
          film plane (--z-film: 40); app-level tokens, not the world's
          theme, so it reads as KOL chrome rather than seller UI. */}
      <Link
        href="/feed"
        aria-label="Back to the KOL feed"
        className="fixed left-3 top-3 z-[60] inline-flex min-h-9 items-center rounded-pill border border-line bg-surface/85 px-4 py-1.5 font-text text-caption uppercase tracking-[0.08em] text-ink backdrop-blur-sm transition-colors duration-state ease-kol hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ← KOL
      </Link>
      {renderStore(world.config, { initialStage: "world-open", pinnedClipId })}
    </>
  );
}
