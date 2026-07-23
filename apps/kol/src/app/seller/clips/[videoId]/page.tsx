import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TagEditor, type ProductOption } from "@/components/tagging/TagEditor";
import { BUYER_LANDING, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { suggestVideoProfileTags } from "@/lib/tagging/actions";
import {
  videoIdSchema,
  videoProfileWriteSchema,
  type VideoProfileWrite,
} from "@/lib/tagging/schemas";

/**
 * Clip tagging page (spec P7) — seller/authoring surface only, no buyer UI.
 * Same role gate as /seller (spec P1): middleware classifies the /seller
 * prefix, and the server-side re-check below keeps the route from leaking to
 * buyers. Routing is UX only — RLS is the actual boundary (B0): the video
 * read is owner-filtered because `videos_public_read_published` would
 * otherwise let any seller open ANOTHER maker's published clip here.
 */

export const metadata: Metadata = { title: "Tag clip — KOL" };

function formatDuration(ms: number | null): string | null {
  if (ms === null || ms <= 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default async function ClipTaggingPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const parsedId = videoIdSchema.safeParse(videoId);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(SIGN_IN_PATH);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "seller") redirect(BUYER_LANDING);

  // Owner filter is explicit (not just RLS): the public-read policy exposes
  // published clips to everyone, but this authoring page is owner-only.
  const { data: video } = await supabase
    .from("videos")
    .select("id, store_id, poster, duration_ms, captions_src")
    .eq("id", parsedId.data)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!video) notFound();

  const { data: profileRow } = await supabase
    .from("video_profiles")
    .select("purpose, page_eligibility, product_links, mood, anti_repetition_key")
    .eq("video_id", video.id)
    .maybeSingle();

  // The DB columns are bare text[] (no CHECK) — parse the row back through
  // the write schema so a pre-Zod garbage row can never seed the editor; it
  // just falls back to an untagged draft the seller re-tags.
  let initial: VideoProfileWrite | null = null;
  if (profileRow) {
    const parsed = videoProfileWriteSchema.safeParse({
      ...profileRow,
      anti_repetition_key: profileRow.anti_repetition_key ?? null,
    });
    initial = parsed.success ? parsed.data : null;
  }

  let products: ProductOption[] = [];
  if (video.store_id) {
    const { data: productRows } = await supabase
      .from("products")
      .select("id, title")
      .eq("store_id", video.store_id)
      .order("title");
    products = productRows ?? [];
  }

  const duration = formatDuration(video.duration_ms);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-page flex-col gap-[var(--space-4)] px-[var(--space-2)] py-[var(--space-4)] md:px-[var(--space-6)]">
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        <Link
          href="/seller"
          className="rounded-sm outline-offset-4 transition-colors duration-state ease-kol hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          KOL
        </Link>
        {" · tag clip"}
      </p>
      <h1 className="max-w-[16ch] font-display text-display-hero [text-wrap:balance]">
        Where should this film live?
      </h1>
      <p className="max-w-measure text-body-lg text-muted">
        {[
          duration ? `${duration} clip` : "Clip",
          video.captions_src ? "captions attached" : "no captions yet",
        ].join(" · ")}
        . Tags decide where it appears — untagged clips stay invisible.
      </p>
      <TagEditor
        videoId={video.id}
        initial={initial}
        products={products}
        suggest={suggestVideoProfileTags}
      />
    </main>
  );
}
