import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { AccountBar } from "@/components/auth/AccountBar";
import { SIGN_IN_PATH } from "@/lib/auth/routes";
import { getFeedSelection } from "@/lib/feed/select";
import { FEED_SESSION_COOKIE, resolveFeedSessionId } from "@/lib/feed/session";
import { createClient } from "@/lib/supabase/server";

import { FeedGrowExperience } from "./FeedGrowExperience";

/**
 * Discovery feed — the PUBLIC front door (W3-B1a, dispatch §7 conflict 2).
 * Anonymous visitors are served the engine's FEED selection with
 * `buyerId: null` (cold start, Relationship term = 0) — no redirect, no
 * gate. Signed-in visitors get the same feed plus their AccountBar.
 * Routing stays UX; RLS remains the only trust boundary (B0): the engine
 * reads eligibility through the server-side ANON client regardless of who
 * is signed in.
 */

export const metadata: Metadata = {
  title: "Discover makers — KOL",
  description:
    "Today's makers on film — watch them work, step inside their worlds, and buy straight from the bench.",
};

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(); // anon-safe: null user renders, never redirects

  const profile = user
    ? (
        await supabase
          .from("profiles")
          .select("role, display_name")
          .eq("id", user.id)
          .maybeSingle()
      ).data
    : null;

  const cookieStore = await cookies();
  const sessionId = resolveFeedSessionId(
    cookieStore.get(FEED_SESSION_COOKIE)?.value,
  );

  const feed = await getFeedSelection({
    buyerId: user?.id ?? null,
    sessionId,
  });

  return (
    // Below md the page carries NO horizontal padding — the §1.6 mobile
    // slots own their own edges (M-BLEED runs viewport edge to edge, the
    // rest carry asymmetric insets). Chrome rows pad themselves.
    <main className="mx-auto flex min-h-screen w-full max-w-page flex-col gap-[var(--space-4)] px-0 py-[var(--space-4)] md:px-[var(--space-6)]">
      {user ? (
        <div className="px-[var(--space-4)] md:px-0">
          <AccountBar
            email={user.email ?? ""}
            displayName={profile?.display_name ?? ""}
            role={profile?.role ?? "buyer"}
          />
        </div>
      ) : (
        <div className="flex items-center justify-end px-[var(--space-4)] md:px-0">
          {/* Quiet affordance — the front door never demands sign-up. */}
          <Link
            href={SIGN_IN_PATH}
            className="font-text text-caption uppercase tracking-[0.04em] text-muted underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      )}
      {/* the feed→grow seam lives in the client composition — a tapped
          card grows through B2's provider (FeedGrowExperience.tsx) */}
      <FeedGrowExperience result={feed} />
    </main>
  );
}
