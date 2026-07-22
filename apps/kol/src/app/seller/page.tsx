import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountBar } from "@/components/auth/AccountBar";
import { BUYER_LANDING, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Seller landing (spec P1 success state: seller → dashboard). The dashboard
 * proper is S7 (Batch 3); P1 owns the role gate. Reaching this page requires
 * profiles.role='seller', which only the service-role onboarding step can
 * set (B0) — the middleware gate plus the server-side re-check below keep
 * the route from leaking to buyers, and RLS keeps the data safe regardless.
 */

export const metadata: Metadata = { title: "Seller dashboard — KOL" };

export default async function SellerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(SIGN_IN_PATH);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "seller") redirect(BUYER_LANDING);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-page flex-col justify-center gap-[var(--space-4)] px-[var(--space-2)] md:px-[var(--space-6)]">
      <AccountBar
        email={user.email ?? ""}
        displayName={profile.display_name}
        role={profile.role}
      />
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        KOL · seller dashboard
      </p>
      <h1 className="max-w-[16ch] font-display text-display-hero [text-wrap:balance]">
        Your world, your counter.
      </h1>
      <p className="max-w-measure text-body-lg text-muted">
        The full dashboard — orders, films, your store world — is on its way.
        Your seller identity and shop ownership are already tied to this
        account.
      </p>
      <p className="text-body-lg">
        <Link
          href="/seller/products"
          className="rounded-sm text-ink underline decoration-line underline-offset-4 outline-offset-4 transition-colors duration-state ease-kol hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Manage your pieces →
        </Link>
      </p>
    </main>
  );
}
