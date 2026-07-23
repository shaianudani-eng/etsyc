// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useFilmLayer, FilmLayerProvider } from "@/components/film/FilmLayer";
import { useFilmSlot } from "@/components/film/useFilmSlot";
import { senaStore } from "@/lib/store-config/fixtures/sena";
import type { GrownSelection } from "@/lib/grow/types";
import { GrowProvider, useGrow, type GrowApi } from "../GrowProvider";
import type { GrowSource } from "../types";

/**
 * B2's binding AC (CPO Ruling 1): "the film frame never unmounts and
 * never shows a paused or black frame." `grow` is a SAME-SOURCE
 * transition, so it requires true element persistence — cross-fading on
 * this edge is forbidden. Deliberately NOT asserted: a single <video>
 * node (the A/B buffers rightly use two). Asserted instead: Film Layer
 * node identity across FEED → GROWN → FEED, an untouched front buffer on
 * grow, and no pause() at any sampled point.
 */

const requestGrownSelection = vi.hoisted(() => vi.fn());
vi.mock("@/lib/grow/actions", () => ({ requestGrownSelection }));

const clip = senaStore.media.clips[0]!;

const GROWN_RESULT: GrownSelection = {
  status: "success",
  grown: {
    videoId: "v1",
    storeId: "s1",
    src: clip.src,
    poster: clip.poster,
    durationMs: 9000,
    captionsSrc: null,
  },
  peers: [
    {
      videoId: "v2",
      storeId: "s1",
      src: "/films/peer.mp4",
      poster: "/stills/peer.jpg",
      durationMs: 8000,
      captionsSrc: null,
    },
  ],
};

const VIDEO_SOURCE: GrowSource = {
  kind: "video",
  videoId: "v1",
  storeId: "s1",
  makerName: "Sena Okafor",
  craft: "Ceramicist",
  place: "Lisbon",
  src: clip.src,
  focalPoint: null,
  poster: clip.poster,
  captionsSrc: null,
};

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Geometry rig: 4:5 feed cards, 16:9 grown column — the G1-F2 shape. */
const CARD_RECT = domRect(40, 120, 320, 400);
const NEIGHBOR_RECT = domRect(380, 460, 320, 400);
const COLUMN_RECT = domRect(360, 80, 720, 405);

function mockGeometry() {
  vi.spyOn(window.HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute("data-grow-window")) return COLUMN_RECT;
    if (this.hasAttribute("data-film-layer")) {
      return domRect(
        Number.parseFloat(this.style.left || "0"),
        Number.parseFloat(this.style.top || "0"),
        Number.parseFloat(this.style.width || "0"),
        Number.parseFloat(this.style.height || "0"),
      );
    }
    if (this.hasAttribute("data-feed-card")) {
      return this.getAttribute("data-card") === "neighbor" ? NEIGHBOR_RECT : CARD_RECT;
    }
    return domRect(0, 0, 0, 0);
  });
}

/** A feed card the way B1b will build one: slot + focus claim + clip. */
function TappedCard() {
  const layer = useFilmLayer();
  const { ref, claim } = useFilmSlot();
  const elRef = useRef<HTMLButtonElement | null>(null);
  return (
    <button
      type="button"
      data-feed-card=""
      data-card="tapped"
      ref={(el) => {
        elRef.current = el;
        ref(el);
      }}
      onClick={() => {
        claim(null);
        layer?.swapClip(clip);
      }}
    >
      Sena Okafor
    </button>
  );
}

function ApiProbe({ onApi }: { onApi: (api: GrowApi) => void }) {
  const api = useGrow();
  if (api) onApi(api);
  return null;
}

function Rig({
  onOpenWorld,
  onApi,
}: {
  onOpenWorld: (payload: unknown) => void;
  onApi: (api: GrowApi) => void;
}) {
  return (
    <FilmLayerProvider>
      <GrowProvider onOpenWorld={onOpenWorld}>
        <TappedCard />
        <div data-feed-card="" data-card="neighbor" />
        <ApiProbe onApi={onApi} />
      </GrowProvider>
    </FilmLayerProvider>
  );
}

function frameOf(container: HTMLElement): HTMLElement {
  const frame = container.querySelector<HTMLElement>("[data-film-layer]");
  expect(frame).not.toBeNull();
  return frame!;
}

function frontVideo(frame: HTMLElement): HTMLVideoElement | null {
  return frame.querySelector<HTMLVideoElement>("video.kol-film-front");
}

function reportCanPlay(frame: HTMLElement) {
  for (const video of frame.querySelectorAll("video")) {
    fireEvent(video, new Event("canplay"));
  }
}

/** Boot the rig to a playing focus-card film, then grow it. */
async function growFromFocusCard(onOpenWorld = vi.fn()) {
  let api: GrowApi | null = null;
  const utils = render(<Rig onOpenWorld={onOpenWorld} onApi={(a) => (api = a)} />);
  const frame = frameOf(utils.container);
  const card = utils.container.querySelector<HTMLElement>('[data-card="tapped"]')!;

  fireEvent.click(card); // focus-film beat: card claims + plays
  reportCanPlay(frame);
  await waitFor(() => expect(frontVideo(frame)?.getAttribute("src")).toBe(clip.src));
  const filmBefore = frontVideo(frame)!;

  act(() => api!.grow(VIDEO_SOURCE, card));
  return { ...utils, frame, card, filmBefore, api: api!, onOpenWorld };
}

beforeEach(() => {
  requestGrownSelection.mockReset();
  requestGrownSelection.mockResolvedValue(GROWN_RESULT);
  mockGeometry();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("B2 grow — film-frame persistence across FEED → GROWN", () => {
  it("grows on the §5.2 edge with true element persistence — no pause, no cross-fade, no remount", async () => {
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, "pause");
    const { container, frame, filmBefore } = await growFromFocusCard();

    // the column is up and the film frame is the SAME node, mid-FLIP on
    // the grow edge (520ms — --dur-grow), now viewport-fixed at the column
    expect(container.querySelector("[data-grow-column]")).not.toBeNull();
    expect(frameOf(container)).toBe(frame);
    expect(container.querySelectorAll("[data-film-layer]")).toHaveLength(1);
    expect(frame.dataset.filmEdge).toBe("grow");
    expect(frame.dataset.filmEdgeMs).toBe("520");
    expect(frame.style.position).toBe("fixed");
    expect(Number.parseFloat(frame.style.width)).toBe(720);

    // same-source: the claim never touched the buffers — the VERY SAME
    // video element is still the front, same src, and the second buffer
    // was never loaded (a cross-fade here is forbidden)
    expect(frontVideo(frame)).toBe(filmBefore);
    expect(frontVideo(frame)!.getAttribute("src")).toBe(clip.src);
    const buffers = Array.from(frame.querySelectorAll<HTMLVideoElement>("video"));
    expect(buffers.filter((b) => b.getAttribute("src") !== null)).toHaveLength(1);

    // at no sampled point was the visible element paused
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it("renders name/craft instantly from metadata, shimmer-edge while loading, and settles on playing", async () => {
    const { container, frame } = await growFromFocusCard();

    // chrome comes from store metadata — it never waits on the video
    expect(container.textContent).toContain("Sena Okafor");
    expect(container.textContent).toContain("Ceramicist · Lisbon"); // uppercased by CSS
    // loading: a progress edge over the poster, never a spinner
    expect(container.querySelector("[data-grow-window] .kol-skeleton")).not.toBeNull();

    // the layer's front buffer reports playing → success state
    fireEvent(frontVideo(frame)!, new Event("playing"));
    await waitFor(() =>
      expect(container.querySelector("[data-grow-window] .kol-skeleton")).toBeNull(),
    );
  });

  it("parts surrounding feed cards on Y only, transform-only, and restores them after ungrow", async () => {
    const { container, card } = await growFromFocusCard();
    const neighbor = container.querySelector<HTMLElement>('[data-card="neighbor"]')!;

    // neighbor overlaps the column band → translates DOWN past it; the
    // tapped card itself never moves
    expect(neighbor.style.transform).toMatch(/^translateY\(\d+px\)$/);
    expect(card.style.transform).toBe("");

    fireEvent.keyDown(document, { key: "Escape" });
    // budget comes from asyncUtilTimeout (vitest.setup.ts) — the release is
    // gated on GrowProvider's chained REAL ungrow timers, so it needs more
    // than waitFor's 1s default, and a local override would only cap it
    await waitFor(() => expect(neighbor.style.transform).toBe(""));
  });

  it("ungrow returns the film to the card on the ungrow edge and never pauses it", async () => {
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, "pause");
    const { container, frame, card, filmBefore } = await growFromFocusCard();

    fireEvent.keyDown(document, { key: "Escape" });
    // §2.5 out: chrome leaves first, THEN the film FLIPs back at 405ms
    await waitFor(() => expect(frame.dataset.filmEdge).toBe("ungrow"));
    expect(frame.dataset.filmEdgeMs).toBe("405");

    await waitFor(() => expect(container.querySelector("[data-grow-column]")).toBeNull());
    // frame identity + geometry: back at the card rect, in-flow, playing
    expect(frameOf(container)).toBe(frame);
    expect(frontVideo(frame)).toBe(filmBefore);
    expect(Number.parseFloat(frame.style.left)).toBe(CARD_RECT.left);
    expect(Number.parseFloat(frame.style.width)).toBe(CARD_RECT.width);
    expect(pauseSpy).not.toHaveBeenCalled();
    // keyboard journey closes where it began
    expect(document.activeElement).toBe(card);
  });

  it("second tap hands off toward WORLD_OPEN with the GROWN selection — and does not unmount the film", async () => {
    const onOpenWorld = vi.fn();
    const { container, frame } = await growFromFocusCard(onOpenWorld);

    await waitFor(() => expect(requestGrownSelection).toHaveBeenCalledWith({ storeId: "s1", tappedVideoId: "v1" }));
    const affordance = await waitFor(() => {
      const el = container.querySelector<HTMLElement>("[data-grow-affordance]");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(affordance.textContent).toContain("open Sena");

    fireEvent.click(affordance);
    expect(onOpenWorld).toHaveBeenCalledTimes(1);
    const handoff = onOpenWorld.mock.calls[0]![0] as {
      source: GrowSource;
      selection: GrownSelection | null;
    };
    expect(handoff.source.storeId).toBe("s1");
    expect(handoff.selection?.status).toBe("success");
    expect(handoff.selection?.peers).toHaveLength(1);

    // a tap on the film itself is the redundant pointer path
    fireEvent.click(frontVideo(frame)!);
    expect(onOpenWorld).toHaveBeenCalledTimes(2);

    // the handoff does NOT tear the surface down — B3 claims the film
    // from a still-live GROWN, so the frame is never parked mid-beat
    expect(container.querySelector("[data-grow-column]")).not.toBeNull();
    expect(frame.dataset.filmParked).toBeUndefined();
  });

  it("a failed clip holds the poster with a quiet inline retry, and retry defeats the same-source no-op", async () => {
    const { container, frame } = await growFromFocusCard();
    const front = frontVideo(frame)!;

    fireEvent(front, new Event("error"));
    const retry = await waitFor(() => {
      const button = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Try again"),
      );
      expect(button).toBeTruthy();
      return button!;
    });
    // the grown state stays usable — the tap-again affordance survives
    expect(container.querySelector("[data-grow-affordance]")).not.toBeNull();

    fireEvent.click(retry);
    await waitFor(() => {
      const reloaded = Array.from(frame.querySelectorAll("video")).find((v) =>
        v.getAttribute("src")?.includes("kolRetry=1"),
      );
      expect(reloaded).toBeTruthy();
    });
  });

  it("reduced motion: the film SNAPS to the column — no FLIP record, no parting — and keeps playing", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    );
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, "pause");
    const { container, frame, filmBefore } = await growFromFocusCard();

    expect(container.querySelector("[data-grow-column]")).not.toBeNull();
    expect(frame.dataset.filmEdge).toBeUndefined(); // snap, not a 0.01ms FLIP
    expect(Number.parseFloat(frame.style.width)).toBe(720);
    const neighbor = container.querySelector<HTMLElement>('[data-card="neighbor"]')!;
    expect(neighbor.style.transform).toBe(""); // §5.3 — transforms removed
    expect(frontVideo(frame)).toBe(filmBefore);
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it("image path: the portrait is a doorway — the CTA hands the slot to the Film Layer", async () => {
    const onOpenWorld = vi.fn();
    let api: GrowApi | null = null;
    const { container } = render(<Rig onOpenWorld={onOpenWorld} onApi={(a) => (api = a)} />);
    const frame = frameOf(container);
    const card = container.querySelector<HTMLElement>('[data-card="tapped"]')!;

    const imageSource: GrowSource = {
      kind: "image",
      videoId: null,
      storeId: "s1",
      makerName: "Sena Okafor",
      craft: "Ceramicist",
      place: "Lisbon",
      src: "",
      focalPoint: null,
      poster: "/stills/sena-portrait.jpg",
      alt: "Sena Okafor at the wheel in her Lisbon studio",
    };
    act(() => api!.grow(imageSource, card));

    // meet the person: real portrait, real alt, name over the scrim
    const portrait = container.querySelector<HTMLImageElement>("[data-grow-portrait]")!;
    expect(portrait.getAttribute("alt")).toContain("Lisbon studio");
    expect(container.textContent).toContain("Sena Okafor");

    // ONE affordance — the accent CTA — once the GROWN selection lands
    const cta = await waitFor(() => {
      const el = container.querySelector<HTMLElement>("[data-grow-cta]");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(cta.textContent).toContain("Watch Sena at work");
    expect(container.querySelector("[data-grow-affordance]")).toBeNull();

    // activating it becomes a normal GROWN: the layer loads the grown clip
    fireEvent.click(cta);
    reportCanPlay(frame);
    await waitFor(() => expect(frontVideo(frame)?.getAttribute("src")).toBe(clip.src));
    // the portrait yields once the film reports playing
    fireEvent(frontVideo(frame)!, new Event("playing"));
    await waitFor(() =>
      expect(container.querySelector("[data-grow-affordance]")).not.toBeNull(),
    );
  });
});
