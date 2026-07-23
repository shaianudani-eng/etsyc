import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyPrompt } from "@/components/states/EmptyPrompt";
import { ErrorInline } from "@/components/states/ErrorInline";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BUYER_LANDING, SIGN_IN_PATH } from "@/lib/auth/routes";
import { formatPrice } from "@/lib/products/schemas";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Product management list (spec S8) — seller-authoring surface in KOL chrome
 * (I7: never themed). Same role gate as /seller (spec P1): middleware
 * classifies the /seller prefix, the server-side re-check below keeps the
 * route from leaking to buyers, and RLS is the actual boundary (B0) — a
 * buyer reaching this URL would read zero seller-owned rows regardless.
 *
 * Deliberately NOT a card grid (NARRATIVE anti-grid): pieces are few, large,
 * human-forward — the list is a ledger, the imagery lives in the world.
 */

export const metadata: Metadata = { title: "Your pieces — KOL" };

const INVENTORY_LABEL = {
  "in-stock": "In stock",
  "made-to-order": "Made to order",
  "sold-out": "Sold out",
} as const;

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
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

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!store) {
    return (
      <Shell>
        <EmptyPrompt
          prompt="Your store isn't set up yet"
          hint="Pieces live inside a store world — store setup arrives with seller onboarding."
        />
      </Shell>
    );
  }

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, title, materials, price_amount, currency, inventory_status, inventory_qty, badges, updated_at",
    )
    .eq("store_id", store.id)
    .order("updated_at", { ascending: false });

  return (
    <Shell storeName={store.name}>
      {deleted === "1" ? (
        <p role="status" className="text-body text-muted">
          The piece is gone from your world.
        </p>
      ) : null}

      {error ? (
        // Error state: quiet, recoverable — a reload link, not a wall.
        <div className="flex flex-col items-start gap-3">
          <ErrorInline message="Your pieces couldn't be loaded just now." />
          <Link href="/seller/products" className={buttonVariants({ variant: "quiet" })}>
            Try reloading
          </Link>
        </div>
      ) : products && products.length === 0 ? (
        // Empty ≠ blank: an invitation with a clear next step.
        <div className="flex flex-col items-start gap-4">
          <EmptyPrompt
            prompt="Add your first piece"
            hint="Title, story, price — that's all it takes for buyers to meet your work."
          />
          <Link
            href="/seller/products/new"
            className={buttonVariants({ variant: "accent" })}
          >
            Add your first piece
          </Link>
        </div>
      ) : products ? (
        <ul className="flex flex-col">
          {products.map((product) => {
            const soldOut = product.inventory_status === "sold-out";
            return (
              <li key={product.id} className="border-t border-line last:border-b">
                <Link
                  href={`/seller/products/${product.id}`}
                  className="group flex min-h-11 flex-col gap-2 py-5 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <span className="flex-1">
                    <span className="font-display text-h3 text-ink transition-colors duration-state ease-kol group-hover:text-accent">
                      {product.title}
                    </span>
                    {product.materials ? (
                      <span className="mt-1 block text-caption uppercase tracking-[0.04em] text-muted">
                        {product.materials}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-2">
                    {product.badges.map((badge) => (
                      <Badge key={badge}>{badge}</Badge>
                    ))}
                    <Badge variant={soldOut ? "ink" : "outline"}>
                      {INVENTORY_LABEL[product.inventory_status]}
                      {product.inventory_qty !== null && !soldOut
                        ? ` · ${product.inventory_qty}`
                        : ""}
                    </Badge>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-body-lg tabular-nums text-ink",
                      soldOut && "text-muted",
                    )}
                  >
                    {formatPrice(product.price_amount, product.currency)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Shell>
  );
}

function Shell({
  storeName,
  children,
}: {
  storeName?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-page flex-col gap-[var(--space-4)] px-[var(--space-2)] py-[var(--space-4)] md:px-[var(--space-6)]">
      {/* Breadcrumb home — same shape the product editor already uses, so
          every seller surface has one way back up. */}
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        <Link
          href="/seller"
          className="rounded-sm outline-offset-4 transition-colors duration-state ease-kol hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          KOL
        </Link>
        {" · your pieces"}
        {storeName ? ` · ${storeName}` : ""}
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="max-w-[16ch] font-display text-display-hero [text-wrap:balance]">
          The pieces in your world.
        </h1>
        <Link
          href="/seller/products/new"
          className={buttonVariants({ variant: "accent" })}
        >
          Add a piece
        </Link>
      </div>
      {children}
    </main>
  );
}
