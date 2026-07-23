import { cache } from "react";

import { validateStoreConfig } from "@/lib/store-config/schema";
import type { StoreConfig } from "@/lib/store-config/types";
import { createClient } from "@/lib/supabase/server";

/**
 * The world lookup for the /w/[handle] segment — ONE declaration, shared by
 * the segment layout (which owns the 404), generateMetadata and the page.
 *
 * `cache` is what makes that sharing free: all three run inside the same
 * request, so the store row is read once and the layout's existence check
 * costs no extra round trip.
 *
 * `published = true` is asserted here on top of RLS, so an unpublished
 * world is a 404 and never a leaked draft.
 */
export const getWorld = cache(
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
