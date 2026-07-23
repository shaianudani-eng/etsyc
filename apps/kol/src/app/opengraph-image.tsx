import { ImageResponse } from "next/og";

/**
 * The share card (og:image) — sunbaked identity in its simplest form:
 * terracotta ground, cream wordmark and brand line. Rendered at request
 * time by next/og; the runtime's bundled font is fine here — the card
 * reads as color and words, and stays a single self-contained file.
 */

export const runtime = "edge";
export const alt = "KOL — every shop is a maker's world";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#c64a2c",
          color: "#fffbf3",
        }}
      >
        <div
          style={{
            fontSize: 40,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          KOL
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            Every shop is a maker&rsquo;s world.
          </div>
          <div style={{ fontSize: 34, opacity: 0.85 }}>
            Real people on film — not a product grid.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
