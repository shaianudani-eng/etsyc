// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilmLayerProvider } from "@/components/film/FilmLayer";
import { senaStore } from "@/lib/store-config/fixtures/sena";

import { StoreWorld } from "./StoreWorld";

/**
 * B5's load-bearing suite: the NARRATE_SHRINK fallback chain as the buyer
 * experiences it. During the seed period (P7 tagging dark) the no-match
 * path is the PRIMARY path — the first test here is the brief's required
 * proof that a product with no matching narration keeps the persistent
 * clip playing in the dock and renders no error.
 *
 * Per the binding AC these tests assert frame identity and absence of
 * pause — deliberately NOT a single <video> node, which the layer's A/B
 * buffers rightly violate.
 */

const { selectNarration } = vi.hoisted(() => ({ selectNarration: vi.fn() }));
vi.mock("@/lib/narration/actions", () => ({ selectNarration }));

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play");
  vi.spyOn(window.HTMLMediaElement.prototype, "pause");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  selectNarration.mockReset();
});

const PRODUCT_ID = "9f5b7c52-3a86-4e0d-9db0-6f5a29d2b101";

const NARRATION_CLIP = {
  videoId: "v_narration",
  src: "/films/narration-mug.mp4",
  poster: "/stills/narration-mug.jpg",
  captionsSrc: null,
};

function renderWorld(narrationProductId: string | null = PRODUCT_ID) {
  return render(
    <FilmLayerProvider>
      <StoreWorld config={senaStore} isPreview narrationProductId={narrationProductId} />
    </FilmLayerProvider>,
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

/** jsdom fires no media events — report canplay on every layer buffer. */
function reportCanPlay(frame: HTMLElement) {
  for (const video of frame.querySelectorAll("video")) {
    fireEvent(video, new Event("canplay"));
  }
}

/** Mount, let the hero claim the film, and hand back the settled rig. */
async function settleWorld(narrationProductId: string | null = PRODUCT_ID) {
  const utils = renderWorld(narrationProductId);
  const frame = frameOf(utils.container);
  reportCanPlay(frame);
  await waitFor(() => expect(frontVideo(frame)).not.toBeNull());
  return { ...utils, frame, heroSrc: frontVideo(frame)!.getAttribute("src")! };
}

function narrationStatus(container: HTMLElement): string | null {
  return container.querySelector("[data-narration]")?.getAttribute("data-narration") ?? null;
}

describe("NARRATE_SHRINK — the fallback chain in the dock", () => {
  it("no-match keeps the persistent clip playing in the dock and renders no error (required proof)", async () => {
    selectNarration.mockResolvedValue({ clip: null });
    const { container, getByRole, frame, heroSrc } = await settleWorld();
    const filmBefore = frontVideo(frame)!;
    const pauseSpy = vi.mocked(window.HTMLMediaElement.prototype.pause);
    pauseSpy.mockClear();

    fireEvent.click(getByRole("button", { name: "Narrate" }));

    await waitFor(() => expect(narrationStatus(container)).toBe("fallback"));
    expect(selectNarration).toHaveBeenCalledWith({
      storeId: senaStore.storeId,
      productId: PRODUCT_ID,
    });

    // the dock docked: viewport-fixed at the §5.3 rect for jsdom's
    // 1024×768 viewport (280×158, bottom-right, 16px inset)…
    expect(frame.getAttribute("data-film-docked")).toBe("true");
    expect(frame.style.position).toBe("fixed");
    expect(frame.style.width).toBe("280px");
    expect(frame.style.height).toBe("158px");
    expect(frame.style.left).toBe(`${1024 - 280 - 16}px`);
    expect(frame.style.top).toBe(`${768 - 158 - 16}px`);

    // …and the film inside it is the SAME element, same source, never
    // paused, with no error surface anywhere
    expect(frontVideo(frame)).toBe(filmBefore);
    expect(frontVideo(frame)!.getAttribute("src")).toBe(heroSrc);
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(container.querySelectorAll("[data-film-layer]")).toHaveLength(1);
    expect(container.textContent).not.toContain("Couldn’t load this clip");
  });

  it("a matching clip cross-fades into the docked frame — same frame, no unmount", async () => {
    selectNarration.mockResolvedValue({ clip: NARRATION_CLIP });
    const { container, getByRole, frame } = await settleWorld();

    fireEvent.click(getByRole("button", { name: "Narrate" }));

    // the narration loads the INACTIVE buffer inside the same frame
    await waitFor(() => {
      expect(frame.querySelector(`video[src="${NARRATION_CLIP.src}"]`)).not.toBeNull();
    });
    reportCanPlay(frame);
    await waitFor(() => {
      expect(frontVideo(frame)?.getAttribute("src")).toBe(NARRATION_CLIP.src);
    });

    expect(narrationStatus(container)).toBe("narrating");
    expect(container.querySelectorAll("[data-film-layer]")).toHaveLength(1);
    expect(container.textContent).not.toContain("Couldn’t load this clip");
  });

  it("a fetch fault retries once, quietly, then falls back to the persistent clip", async () => {
    selectNarration.mockRejectedValue(new Error("network down"));
    const { container, getByRole, frame, heroSrc } = await settleWorld();

    fireEvent.click(getByRole("button", { name: "Narrate" }));

    // budget comes from asyncUtilTimeout (vitest.setup.ts) — the fallback
    // lands only after the hook's REAL RETRY_DELAY_MS (800ms) elapses, so
    // it needs more than waitFor's 1s default, and a local override would
    // only cap it below the global
    await waitFor(() => expect(narrationStatus(container)).toBe("fallback"));
    expect(selectNarration).toHaveBeenCalledTimes(2); // one call + ONE retry
    expect(frontVideo(frame)!.getAttribute("src")).toBe(heroSrc);
    expect(container.textContent).not.toContain("Couldn’t load this clip");
  });

  it("a stale response never swaps after the buyer undocks", async () => {
    let resolveNarration!: (value: { clip: typeof NARRATION_CLIP }) => void;
    selectNarration.mockReturnValue(
      new Promise((resolve) => {
        resolveNarration = resolve;
      }),
    );
    const { container, getByRole, frame } = await settleWorld();

    fireEvent.click(getByRole("button", { name: "Narrate" }));
    await waitFor(() => expect(narrationStatus(container)).toBe("loading"));

    // buyer leaves NARRATE_SHRINK before the engine answers…
    fireEvent.click(getByRole("button", { name: "Browse" }));
    await waitFor(() => expect(narrationStatus(container)).toBe("idle"));

    // …so the late clip must be discarded, not swapped into the world film
    resolveNarration({ clip: NARRATION_CLIP });
    await act(async () => {
      await Promise.resolve();
    });
    expect(frame.querySelector(`video[src="${NARRATION_CLIP.src}"]`)).toBeNull();
    expect(narrationStatus(container)).toBe("idle");
  });

  it("no product id still narrates — the engine's store-wide rung gets the null", async () => {
    selectNarration.mockResolvedValue({ clip: null });
    const { container, getByRole } = await settleWorld(null);

    fireEvent.click(getByRole("button", { name: "Narrate" }));

    await waitFor(() => expect(narrationStatus(container)).toBe("fallback"));
    expect(selectNarration).toHaveBeenCalledWith({
      storeId: senaStore.storeId,
      productId: null,
    });
  });

  it("B4 → B5 seam: tapping a product narrates THAT product — the click state feeds the hook", async () => {
    // The integration defect this pins: B4 recorded the tapped product as
    // internal state + data-selected-product; B5's hook read only the
    // narrationProductId PROP, which nothing on the in-world journey
    // passes. Both units were green in isolation (every test in this file
    // feeds the prop; B4's suite mocks the browse action, not narration)
    // while NARRATE_SHRINK silently narrated the store-wide fallback
    // instead of the product the buyer tapped. This test walks the REAL
    // path — no prop, a genuine product click — and fails if the hook and
    // the interaction state ever come unwired again.
    selectNarration.mockResolvedValue({ clip: NARRATION_CLIP });
    const utils = render(
      <FilmLayerProvider>
        <StoreWorld config={senaStore} initialStage="world-browse" />
      </FilmLayerProvider>,
    );
    const frame = frameOf(utils.container);
    reportCanPlay(frame);
    await waitFor(() => expect(frontVideo(frame)).not.toBeNull());

    // the buyer taps a product IN the world — B4's doorway toward B5
    fireEvent.click(utils.getByRole("button", { name: /Ridge Tumbler/i }));

    // B4's half of the handoff: stage + the recorded product
    const root = utils.container.querySelector("[data-world-stage]")!;
    expect(root.getAttribute("data-world-stage")).toBe("narrate-shrink");
    expect(root.getAttribute("data-selected-product")).toBe("p_ridge_tumbler");

    // B5's half: the engine is asked for THE TAPPED PRODUCT, never the
    // store-wide null rung
    await waitFor(() => {
      expect(selectNarration).toHaveBeenCalledWith({
        storeId: senaStore.storeId,
        productId: "p_ridge_tumbler",
      });
    });
    await waitFor(() => expect(narrationStatus(utils.container)).toBe("narrating"));
  });
});
