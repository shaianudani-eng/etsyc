"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ErrorInline } from "@/components/states/ErrorInline";
import { Skeleton } from "@/components/states/Skeleton";
import { buttonVariants } from "@/components/ui/button";
import type { FeedCard, FeedResult } from "@/lib/feed/select";
import { cn } from "@/lib/utils";

import {
  DESKTOP_ASPECT_CLASS,
  FeedCardView,
  MOBILE_ASPECT_CLASS,
  MOBILE_CAPTION_CLASS,
  MOBILE_MEDIA_CLASS,
  MOBILE_RHYTHM_CLASS,
  SLOT_PLACEMENT_CLASS,
  slotLiftProps,
} from "./FeedCard";
import {
  ambientCountForVisible,
  ambientIndicesFor,
  FOCUS_DEBOUNCE_MS,
  pickFocusIndex,
} from "./focus";
import { composeFeed, composeMobileFeed, MOBILE_SLOTS } from "./spreads";

/**
 * FeedMagazine (W3-B1b) — the discovery feed's magazine composition. A
 * magazine index of PEOPLE, not a catalogue of things: cards are placed
 * by the content-aware assignment in spreads.ts (cost-based, deterministic,
 * period-gated — never a cycle), the card nearest viewport centre carries
 * the shared Film Layer, and ambient loops scale with how many cards are
 * actually in view. KOL chrome only — the feed never adopts a seller
 * theme (Invariant I7).
 *
 * All four states render here:
 *   success — the live composition + Focus Film.
 *   empty   — a warm invitation, never a blank void (§1.5).
 *   error   — the last cached selection (sessionStorage) with a quiet
 *             inline retry; with no cache, the invitation layout with
 *             error copy. Never blank.
 *   loading — FeedMagazineSkeleton below, mounted by app/feed/loading.tsx
 *             at the exact spread geometry (no spinner, no CLS).
 */

/** Last successful selection, for the error state (screen-specs §1.5). */
export const FEED_CACHE_KEY = "kol:feed:last-selection:v1";

/**
 * Initial focus claim waits for the opening cards' entrance reveal to
 * settle (--dur-reveal 520 + 2×70 stagger + margin) — a rect measured
 * mid-reveal would park the film 16px off the card.
 */
const INITIAL_FOCUS_DELAY_MS = 700;

/**
 * The loading skeleton renders the N=4 (R-LEAD + R-INSET) composition:
 * the seed period serves exactly 4 makers (one clip per store × 4
 * published seed worlds), so this is the real final geometry today. The
 * opening R-LEAD row is identical for every N≥2, so the first viewport
 * stays CLS-0 even after the pool grows; bump alongside the seed pool.
 */
const SKELETON_CARD_COUNT = 4;

export function FeedMagazine({
  result,
  onGrow,
}: {
  result: FeedResult;
  /**
   * B2's grow seam: fires after the tapped card is promoted to focus
   * (the shared Film Layer is already on it — the element B2 promotes is
   * the layer itself, so nothing remounts on tap). Unset today.
   */
  onGrow?: (card: FeedCard, element: HTMLElement | null) => void;
}) {
  const router = useRouter();

  // Hydration-safe cache read: the server snapshot is null (no storage on
  // the server), the client snapshot is the stored string — parsed lazily
  // and only for the error state.
  const cachedRaw = useSyncExternalStore(
    subscribeToNothing,
    readCacheSnapshot,
    getServerCacheSnapshot,
  );
  const cachedCards = useMemo(
    () => (result.status === "error" ? parseCachedCards(cachedRaw) : null),
    [result.status, cachedRaw],
  );

  useEffect(() => {
    if (result.status === "success" && result.cards.length > 0) {
      try {
        window.sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(result.cards));
      } catch {
        // storage denied (private mode / quota) — the cache is best-effort
      }
    }
  }, [result]);

  const retry = useCallback(() => {
    router.refresh(); // re-runs the server selection — no client fetch path
  }, [router]);

  if (result.status === "error") {
    if (cachedCards !== null) {
      return (
        <section aria-label="Makers on film" className="flex flex-col">
          <ErrorInline
            message="Showing you the last set — we couldn’t reach the new one."
            onRetry={retry}
            className="mb-[var(--space-6)] w-fit mx-[var(--space-4)] md:mx-0"
          />
          <MagazineBody cards={cachedCards} onGrow={onGrow} />
        </section>
      );
    }
    return <FeedUnreachable onRetry={retry} />;
  }

  if (result.status === "empty" || result.cards.length === 0) {
    return <FeedInvitation />;
  }

  return (
    <section aria-label="Makers on film" className="flex flex-col">
      <MagazineBody cards={result.cards} onGrow={onGrow} />
    </section>
  );
}

/** The live composition: masthead + rows + Focus Film selection. */
function MagazineBody({
  cards,
  onGrow,
}: {
  cards: FeedCard[];
  onGrow?: (card: FeedCard, element: HTMLElement | null) => void;
}) {
  // Content-aware assignment (spreads.ts): FeedCard is structurally a
  // ComposableCard, so the view-model passes straight through. Mobile
  // runs the same rule over the §1.6 slot table; both are card-ordered,
  // so one DOM order serves both compositions.
  const rows = useMemo(() => composeFeed(cards), [cards]);
  const mobileSlots = useMemo(
    () => composeMobileFeed(cards).map(({ slot }) => slot),
    [cards],
  );
  const cardEls = useRef<(HTMLElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  const evaluateFocus = useCallback(() => {
    const viewportCentre = window.innerHeight / 2;
    let inView = 0;
    const distances = cards.map((_, index) => {
      const element = cardEls.current[index];
      if (!element) return Number.POSITIVE_INFINITY;
      const rect = element.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) inView += 1;
      return Math.abs(rect.top + rect.height / 2 - viewportCentre);
    });
    setVisibleCount(inView);
    const next = pickFocusIndex(distances);
    if (next !== null) setFocusIndex(next);
  }, [cards]);

  // Scroll/resize re-target the focus card, trailing-debounced so focus
  // changes at most once per 400ms (AC) — a film that re-targets on every
  // scroll tick is nausea, not life.
  useEffect(() => {
    let timer: number | null = null;
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(evaluateFocus, FOCUS_DEBOUNCE_MS);
    };
    const settle = window.setTimeout(evaluateFocus, INITIAL_FOCUS_DELAY_MS);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(settle);
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [evaluateFocus]);

  // Ambient budget is a function of cards in view (gate-2 ruling):
  // 0 at ≤2 in view · 1 at 3 · 2 at ≥4. Everything-moving is the
  // TikTok-Shop register §2.4 bans.
  const ambient = useMemo(
    () =>
      new Set(
        focusIndex === null
          ? []
          : ambientIndicesFor(
              focusIndex,
              cards.length,
              ambientCountForVisible(visibleCount),
            ),
      ),
    [focusIndex, cards.length, visibleCount],
  );

  // Tap: promote to focus immediately (claim snaps + --dur-swap in-frame
  // cross-fade, ≤200ms — the debounce never delays an intentional tap),
  // then hand off to B2's grow.
  const activate = useCallback(
    (index: number, card: FeedCard, element: HTMLElement | null) => {
      setFocusIndex(index);
      onGrow?.(card, element);
    },
    [onGrow],
  );

  return (
    <>
      <Masthead count={cards.length} />
      <div className="mt-[var(--space-12)] flex flex-col md:gap-[var(--space-16)]">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            data-feed-row={row.pattern}
            className="grid grid-cols-1 items-start md:grid-cols-12 md:gap-x-[var(--space-6)]"
          >
            {row.slots.map(({ slot, cardIndex, raisePct }, indexInRow) => {
              const card = cards[cardIndex];
              if (card === undefined) return null; // composeFeed covers 0..N-1 exactly
              return (
                <FeedCardView
                  key={card.videoId}
                  card={card}
                  slot={slot}
                  raisePct={raisePct}
                  mobileSlot={mobileSlots[cardIndex] ?? MOBILE_SLOTS["M-FULL"]}
                  indexInRow={indexInRow}
                  isFocus={focusIndex === cardIndex}
                  isAmbient={ambient.has(cardIndex)}
                  cardRef={(element) => {
                    cardEls.current[cardIndex] = element;
                  }}
                  onActivate={(element) => activate(cardIndex, card, element)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

/** The feed's single display moment (§1.4) — live, honest count. */
function Masthead({ count }: { count: number }) {
  return (
    <header className="flex flex-col gap-[var(--space-1)] px-[var(--space-4)] md:px-0">
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        KOL · Today
      </p>
      <h1 className="max-w-[24ch] font-display text-h1 font-medium [text-wrap:balance]">
        {countLine(count)}
      </h1>
    </header>
  );
}

/** Empty ≠ blank: a warm invitation in the interface's voice (§1.5). */
function FeedInvitation() {
  return (
    <section
      aria-label="No makers yet"
      className="flex flex-col gap-[var(--space-2)] px-[var(--space-4)] md:px-0"
    >
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        KOL · Today
      </p>
      {/* One layout, two truths: a marketplace with no worlds yet AND a
          session that has watched every open world both land here — the
          copy must be honest for both (the ring resets on session expiry,
          engine spec §3.1, so "check back soon" is literal). */}
      <h1 className="max-w-[18ch] font-display text-h1 font-medium [text-wrap:balance]">
        You’re all caught up.
      </h1>
      <p className="max-w-measure text-body-lg text-muted">
        Every world that’s open right now has been in your feed. New makers
        are always setting up their benches — check back soon.
      </p>
      <Link
        href="/seller"
        className={cn(buttonVariants({ variant: "accent" }), "mt-[var(--space-2)] w-fit")}
      >
        Are you a maker?
      </Link>
    </section>
  );
}

/** Error with no cache: the invitation layout carrying error copy + retry. */
function FeedUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-label="Feed unavailable"
      className="flex flex-col gap-[var(--space-2)] px-[var(--space-4)] md:px-0"
    >
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        KOL · Today
      </p>
      <h1 className="max-w-[18ch] font-display text-h1 font-medium [text-wrap:balance]">
        The makers are still here.
      </h1>
      <ErrorInline
        message="We’re having trouble reaching them — try again in a moment."
        onRetry={onRetry}
        className="w-fit"
      />
    </section>
  );
}

/**
 * Route-level loading state (app/feed/loading.tsx): the full row geometry
 * renders immediately with skeletons at the exact slot aspects — the
 * COMPOSITION is visible before the content is, which is itself the
 * identity statement. Raise geometry is slot-derived (spreads.test.ts
 * "skeleton parity"), so the skeleton matches the live layout to the
 * pixel. Name/craft lines are two shimmer bars at real line lengths. No
 * spinner anywhere; posters then resolve per card in place.
 */
export function FeedMagazineSkeleton() {
  const synthetic = Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => ({
    videoId: `skeleton-${i}`,
    aspect: "4:5" as const,
    focalPoint: null,
  }));
  const rows = composeFeed(synthetic);
  const mobileSlots = composeMobileFeed(synthetic).map(({ slot }) => slot);
  return (
    <section aria-label="Loading makers" aria-busy="true" className="flex flex-col">
      <div className="flex flex-col gap-[var(--space-1)] px-[var(--space-4)] md:px-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full max-w-md md:h-14" />
      </div>
      <div className="mt-[var(--space-12)] flex flex-col md:gap-[var(--space-16)]">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-1 items-start md:grid-cols-12 md:gap-x-[var(--space-6)]"
          >
            {row.slots.map(({ slot, cardIndex, raisePct }) => {
              const mobileSlot = mobileSlots[cardIndex] ?? MOBILE_SLOTS["M-FULL"];
              const lift = slotLiftProps(slot, raisePct);
              return (
                <div
                  key={slot.name}
                  className={cn(
                    "min-w-0 self-start",
                    SLOT_PLACEMENT_CLASS[slot.name],
                    lift.className,
                    MOBILE_RHYTHM_CLASS[mobileSlot.name],
                  )}
                  style={lift.style}
                >
                  <Skeleton
                    className={cn(
                      "rounded-md",
                      MOBILE_ASPECT_CLASS[mobileSlot.aspect],
                      MOBILE_MEDIA_CLASS[mobileSlot.name],
                      DESKTOP_ASPECT_CLASS[slot.aspect],
                    )}
                  />
                  <div
                    className={cn(
                      "mt-[var(--space-2)] flex flex-col gap-[var(--space-0-5)]",
                      MOBILE_CAPTION_CLASS[mobileSlot.name],
                    )}
                  >
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

const COUNT_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
] as const;

/** "Four people who make things." — live and honest; a fabricated count
 *  is a trust failure in a product whose premise is honesty (§1.4). */
function countLine(count: number): string {
  if (count === 1) return "One person who makes things.";
  const word = COUNT_WORDS[count] ?? String(count);
  return `${word} people who make things.`;
}

/** The cache never changes under us mid-session — subscribe to nothing. */
function subscribeToNothing(): () => void {
  return () => {};
}

function readCacheSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(FEED_CACHE_KEY);
  } catch {
    return null;
  }
}

function getServerCacheSnapshot(): null {
  return null;
}

/**
 * The cached selection is own-origin data, but it still crosses a JSON
 * boundary — verify every field the composition consumes before trusting
 * it, and drop the cache wholesale on any mismatch.
 */
function parseCachedCards(raw: string | null): FeedCard[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.every(isFeedCardLike) ? parsed : null;
  } catch {
    return null;
  }
}

function isFeedCardLike(value: unknown): value is FeedCard {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  const nullableString = (v: unknown) => v === null || typeof v === "string";
  const focal = card.focalPoint as Record<string, unknown> | null | undefined;
  return (
    typeof card.videoId === "string" &&
    typeof card.storeId === "string" &&
    typeof card.storeSlugOrId === "string" &&
    typeof card.makerName === "string" &&
    typeof card.src === "string" &&
    nullableString(card.craft) &&
    nullableString(card.place) &&
    nullableString(card.avatarUrl) &&
    nullableString(card.poster) &&
    nullableString(card.captionsSrc) &&
    (card.durationMs === null || typeof card.durationMs === "number") &&
    typeof card.aspect === "string" &&
    (focal == null ||
      (typeof focal === "object" &&
        typeof focal.x === "number" &&
        typeof focal.y === "number"))
  );
}
