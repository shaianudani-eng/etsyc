import { ImageResponse } from "next/og";

import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Per-world share card: a shared world unfurls with the MAKER's name,
 * not the generic site card. Reads at B0 trust (ANON client) — an
 * unpublished handle degrades to the brand-only card, never a leak.
 */

export const alt = "A maker's world on KOL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type CardFacts = { displayName: string; craft: string; location: string };

async function getFacts(handle: string): Promise<CardFacts | null> {
  try {
    const { data } = await createAnonClient()
      .from("stores")
      .select("config")
      .eq("handle", handle)
      .eq("published", true)
      .maybeSingle();
    const maker = (data?.config as { maker?: Record<string, unknown> })?.maker;
    if (typeof maker?.displayName !== "string") return null;
    return {
      displayName: maker.displayName,
      craft: typeof maker.craft === "string" ? maker.craft : "",
      location: typeof maker.location === "string" ? maker.location : "",
    };
  } catch {
    return null;
  }
}

export default async function WorldOgImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const facts = await getFacts(handle);
  const detail = facts
    ? [facts.craft, facts.location].filter(Boolean).join(" · ")
    : "";

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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
            {facts ? facts.displayName : "Every shop is a maker’s world."}
          </div>
          {detail !== "" ? (
            <div
              style={{
                fontSize: 34,
                opacity: 0.85,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {detail}
            </div>
          ) : null}
          <div style={{ fontSize: 30, opacity: 0.7 }}>
            Step inside their world on KOL.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
