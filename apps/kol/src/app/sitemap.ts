import type { MetadataRoute } from "next";

import { createAnonClient } from "@/lib/supabase/anon";

const BASE = "https://etsyc.vercel.app";

/**
 * Sitemap: the static public surfaces plus every PUBLISHED world. Reads
 * through the server-side ANON client so unpublished stores can never leak
 * into the index — same trust level as an anonymous visitor (B0).
 *
 * Revalidated hourly: without this Next would freeze the sitemap at build
 * time and a newly published world would stay unindexable until the next
 * deploy — which, for a marketplace whose sellers publish on their own
 * schedule, means never.
 */
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/feed`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/sign-in`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const { data } = await createAnonClient()
      .from("stores")
      .select("handle")
      .eq("published", true);
    const worlds: MetadataRoute.Sitemap = (data ?? []).map((s) => ({
      url: `${BASE}/w/${s.handle}`,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...staticEntries, ...worlds];
  } catch {
    // A DB hiccup degrades to the static map, never to a 500 sitemap.
    return staticEntries;
  }
}
