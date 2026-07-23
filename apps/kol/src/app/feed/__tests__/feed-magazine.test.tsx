// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FEED_CACHE_KEY,
  FeedMagazine,
  FeedMagazineSkeleton,
} from "@/components/feed/FeedMagazine";
import type { FeedCard, FeedResult } from "@/lib/feed/select";

/**
 * State-surface tests for the magazine (W3-B1b). Layout truth (measured
 * boxes, the anti-grid gate) lives in e2e/feed-layout.spec.ts — jsdom
 * does no layout, so these tests own the four states, the honest
 * masthead count, the composition's slot assignment, and the
 * promote-on-tap seam. No FilmLayerProvider is mounted: the Focus Film
 * path must DEGRADE (poster stills, no crash), which is itself the
 * contract useFilmSlot promises provider-less callers.
 */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function makeCard(i: number, overrides: Partial<FeedCard> = {}): FeedCard {
  return {
    videoId: `video-${i}`,
    storeId: `store-${i}`,
    storeSlugOrId: `store-${i}`,
    makerName: ["Sena Okafor", "Noor Haddad", "Marta Ferreira", "Isolde Brandt"][i % 4] ?? `Maker ${i}`,
    craft: ["Ceramicist", "Natural dyer", "Letterpress printer", "Glassblower"][i % 4] ?? null,
    place: ["Lisbon", "Amman", "Porto", "Copenhagen"][i % 4] ?? null,
    avatarUrl: null,
    src: `/media/fixtures/clip-${i}.mp4`,
    poster: `/media/ashwork/intro-poster.svg`,
    durationMs: 9000,
    captionsSrc: null,
    aspect: "4:5",
    focalPoint: { x: 0.5, y: 0.32 },
    ...overrides,
  };
}

const success = (n: number): FeedResult => ({
  status: "success",
  cards: Array.from({ length: n }, (_, i) => makeCard(i)),
});

beforeEach(() => {
  window.sessionStorage.clear();
  refresh.mockClear();
});

afterEach(cleanup);

describe("success — the live composition", () => {
  it("masthead count is live, honest, and grammatical", () => {
    const { unmount } = render(<FeedMagazine result={success(4)} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Four people who make things." }),
    ).toBeTruthy();
    unmount();

    render(<FeedMagazine result={success(1)} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "One person who makes things." }),
    ).toBeTruthy();
  });

  it("N=4 lands in the R-LEAD + R-INSET termination with one card per slot", () => {
    const { container } = render(<FeedMagazine result={success(4)} />);
    const slots = Array.from(container.querySelectorAll("[data-feed-slot]")).map(
      (el) => el.getAttribute("data-feed-slot"),
    );
    expect(slots).toEqual(["LEAD", "SIDE", "INSET", "TALL"]);
  });

  it("every card carries the §1.6 mobile slot the composer assigned it", async () => {
    const { composeMobileFeed } = await import("@/components/feed/spreads");
    const cards = success(8).cards;
    const expected = composeMobileFeed(cards).map(({ slot }) => slot.name);
    const { container } = render(
      <FeedMagazine result={{ status: "success", cards }} />,
    );
    const rendered = Array.from(
      container.querySelectorAll("[data-feed-mobile-slot]"),
    ).map((el) => el.getAttribute("data-feed-mobile-slot"));
    expect(rendered).toEqual(expected);
    // the caption aligns to its own media's left edge — M-OFF-R indents
    // --space-16, everything else --space-4 (the zig-zag mechanism)
    expect(new Set(expected).size).toBeGreaterThanOrEqual(3);
  });

  it("every card is a keyboard-reachable button named for its maker", () => {
    render(<FeedMagazine result={success(4)} />);
    const buttons = screen.getAllByRole("button", { name: /^Watch / });
    expect(buttons).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Watch Sena Okafor — Ceramicist · Lisbon" }),
    ).toBeTruthy();
  });

  it("tapping a card promotes it to focus immediately (grow seam for B2)", () => {
    const onGrow = vi.fn();
    const { container } = render(
      <FeedMagazine result={success(4)} onGrow={onGrow} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Watch Marta Ferreira/ }),
    );
    const focused = container.querySelector("[data-feed-focus]");
    expect(focused?.getAttribute("data-feed-slot")).toBe("INSET");
    expect(onGrow).toHaveBeenCalledTimes(1);
    expect(onGrow.mock.calls[0]?.[0]).toMatchObject({ videoId: "video-2" });
  });

  it("caches the selection for the error state", () => {
    render(<FeedMagazine result={success(4)} />);
    const cached = window.sessionStorage.getItem(FEED_CACHE_KEY);
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached ?? "[]")).toHaveLength(4);
  });

  it("carries no urgency chrome — no prices, discounts, or star clutter", () => {
    const { container } = render(<FeedMagazine result={success(4)} />);
    expect(container.textContent).not.toMatch(/[%£$€★]|\bsold\b|\boff\b/i);
  });
});

describe("empty — a warm invitation, never a blank void", () => {
  it("renders the invitation with the maker CTA", () => {
    render(<FeedMagazine result={{ status: "empty", cards: [] }} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /You’re all caught up\./ }),
    ).toBeTruthy();
    const cta = screen.getByRole("link", { name: "Are you a maker?" });
    expect(cta.getAttribute("href")).toBe("/seller");
  });
});

describe("error — never blank", () => {
  it("serves the last cached selection with a quiet inline retry", async () => {
    window.sessionStorage.setItem(
      FEED_CACHE_KEY,
      JSON.stringify(success(4).cards),
    );
    render(<FeedMagazine result={{ status: "error", cards: [] }} />);
    expect(
      await screen.findByText(/Showing you the last set/),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Four people who make things." }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("falls through to the invitation layout with retry when no cache exists", () => {
    render(<FeedMagazine result={{ status: "error", cards: [] }} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "The makers are still here." }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed cache rather than rendering from it", async () => {
    window.sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify([{ nope: 1 }]));
    render(<FeedMagazine result={{ status: "error", cards: [] }} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "The makers are still here." }),
    ).toBeTruthy();
  });
});

describe("loading — skeleton at the real spread geometry", () => {
  it("renders slot-shaped skeletons and no spinner", () => {
    const { container } = render(<FeedMagazineSkeleton />);
    expect(container.querySelectorAll(".kol-skeleton").length).toBeGreaterThan(4);
    expect(container.querySelector("[role='progressbar']")).toBeNull();
    expect(container.textContent).not.toMatch(/loading…|spinner/i);
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-busy")).toBe("true");
  });
});
