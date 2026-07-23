"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { createEngineDeps, selectVideos } from "@/lib/engine";
import { FEED_RING_COOKIE, ringCookieOptions } from "@/lib/feed/select";
import { FEED_SESSION_COOKIE, resolveFeedSessionId } from "@/lib/feed/session";
import { createClient } from "@/lib/supabase/server";

import { type BrowseClipResult } from "./contract";

/**
 * The WORLD_BROWSE server boundary — the browser never touches the engine
 * (its composition root is server-only by design). A server action rather
 * than a route handler because the anti-repetition ring must be WRITTEN
 * per selection, and actions are the one client-callable surface that may
 * set cookies (the feed's RSC deliberately cannot — B1a convergence).
 *
 * SWAPS ARE SCORING-DRIVEN, NEVER RANDOM (AC): the clip comes out of
 * `selectVideos`' weighted-sum ranking, and stage 3 (anti-repetition)
 * always runs after scoring, so nothing loops within the session. This
 * module contains no selection logic of its own — it is context assembly
 * and a view-model.
 */

const StoreIdSchema = z.string().uuid();

/**
 * Select the next `process`/`atmosphere` clip for a browsing buyer, or
 * `null` when nothing is eligible — the caller keeps the current clip
 * playing (graceful, never an error; screen-specs §4.4). A session that
 * has already seen every eligible clip does NOT land here: stage 3's
 * exhaustion encore (video-engine §3.1) re-serves a fresh lap, so a long
 * browse keeps swapping instead of freezing on one clip. Engine, DB, or
 * config failures also resolve `null`: a swap that can't happen is a
 * non-event, never error chrome over a playing film.
 */
export async function selectBrowseClip(storeId: string): Promise<BrowseClipResult> {
  // Zod gate on the one external input. Non-uuid store ids (fixtures,
  // preview surfaces) short-circuit before any DB work.
  const parsedStoreId = StoreIdSchema.safeParse(storeId);
  if (!parsedStoreId.success) return null;

  try {
    const cookieStore = await cookies();

    // Session identity: THE feed's session — same cookie, same validator —
    // so the shopkeeper who greeted this buyer in the feed is the one
    // talking in the world. Minted by the proxy middleware only (two
    // minters = races); resolveFeedSessionId treats a missing/tampered
    // value as fresh-anonymous for this request, never reusing raw input.
    const sessionId = resolveFeedSessionId(cookieStore.get(FEED_SESSION_COOKIE)?.value);

    // Anon-safe buyer identity: null = anonymous (Relationship term is 0).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // createEngineDeps is the ONLY permitted entry point — it wires the
    // anon client internally so eligibility can never see a signed-in
    // seller's drafts (§B0 / W2-WIRE). The ring value is engine-owned and
    // HMAC-signed — passed through opaque; a tampered ring reads as empty.
    // This write IS the ring's persistence path across states: the feed's
    // RSC reads but cannot persist, so the ring written here is the ring
    // the feed reads next.
    const deps = createEngineDeps({
      read: () => cookieStore.get(FEED_RING_COOKIE)?.value,
      // the canonical attribute set — imported, never re-typed (DECISIONS);
      // a function so `secure` resolves NODE_ENV at write time, and diverging
      // attributes cannot fork the cookie by scope between journey states
      write: (value) => cookieStore.set(FEED_RING_COOKIE, value, ringCookieOptions()),
    });

    const selection = await selectVideos(
      {
        state: "WORLD_BROWSE",
        buyerId: user?.id ?? null,
        sessionId,
        storeScope: parsedStoreId.data,
        productId: null,
        moodHint: null,
        limit: 1,
      },
      deps,
    );

    const clip = selection.clips[0];
    if (!clip) return null;

    return {
      videoId: clip.videoId,
      src: clip.src,
      poster: clip.poster,
      captionsSrc: clip.captionsSrc,
    };
  } catch {
    // Missing secret, DB outage, malformed anything → keep the current
    // clip. The film always wins; the failure surfaces in server logs,
    // never in the world.
    return null;
  }
}
