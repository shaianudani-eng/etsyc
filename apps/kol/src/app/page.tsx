import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth/routes";
import { createAnonClient } from "@/lib/supabase/anon";
import { cn } from "@/lib/utils";

/**
 * Public landing — KOL's front door (fixed sunbaked identity, D15a).
 * Routes stay honest: every CTA leads to a live surface — the discovery
 * feed (W3-B1a public front door), sign-in, or the seller gate (P1).
 * The maker index reads PUBLISHED stores through the server-side ANON
 * client (B0 trust level) and simply disappears on any failure.
 */

// The index refreshes as worlds publish; the page stays statically served.
export const revalidate = 300;

type MakerEntry = {
  handle: string;
  displayName: string;
  craft: string;
  location: string;
};

async function getLiveMakers(): Promise<MakerEntry[]> {
  try {
    const { data } = await createAnonClient()
      .from("stores")
      .select("handle, config")
      .eq("published", true)
      .order("handle")
      .limit(8);
    return (data ?? []).flatMap((store) => {
      const maker = (store.config as { maker?: Record<string, unknown> })
        ?.maker;
      if (typeof maker?.displayName !== "string" || maker.displayName === "")
        return [];
      return [
        {
          handle: store.handle,
          displayName: maker.displayName,
          craft: typeof maker.craft === "string" ? maker.craft : "",
          location: typeof maker.location === "string" ? maker.location : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

export default async function Home() {
  const makers = await getLiveMakers();

  // Structured data: what KOL is, machine-readably. Values mirror the
  // rendered page only — nothing here that isn't visible to a person.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "KOL",
    url: "https://etsyc.vercel.app",
    description:
      "A video-native marketplace where every shop is a maker's world — real people on film, not a product grid.",
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-page flex-col justify-center gap-[var(--space-6)] px-[var(--space-2)] py-[var(--space-6)] md:flex-row md:items-center md:justify-between md:gap-[var(--space-8)] md:px-[var(--space-6)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex max-w-[44rem] flex-col gap-[var(--space-4)]">
        <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
          KOL · A marketplace of makers
        </p>
        <h1 className="max-w-[16ch] font-display text-display-hero [text-wrap:balance]">
          Every shop is a maker&rsquo;s world.
        </h1>
        <p className="max-w-measure text-body-lg text-muted">
          Watch letterpress printers, leatherworkers, glassblowers, and
          woodturners at work — then step inside their worlds and buy what
          they make, straight from the bench.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/feed"
            className={cn(buttonVariants({ variant: "accent" }), "min-h-11 px-6")}
          >
            Discover makers
          </Link>
          <Link
            href={SIGN_IN_PATH}
            className="inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-6 py-2.5 text-ink transition-colors duration-state ease-kol hover:bg-ground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
          >
            Sign in
          </Link>
        </div>
        <Link
          href="/seller"
          className="w-fit rounded-sm font-text text-caption uppercase tracking-[0.04em] text-muted underline-offset-4 outline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Are you a maker? Open your world
        </Link>
      </div>

      {makers.length > 0 ? (
        <nav
          aria-label="Makers live on KOL today"
          className="flex shrink-0 flex-col gap-[var(--space-3)] border-t border-line pt-[var(--space-4)] md:max-w-[20rem] md:border-l md:border-t-0 md:pl-[var(--space-6)] md:pt-0"
        >
          <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
            In the feed today
          </p>
          <ul className="flex flex-col gap-[var(--space-3)]">
            {makers.map((maker) => (
              <li key={maker.handle}>
                <Link
                  href={`/w/${maker.handle}`}
                  className="group flex w-fit flex-col rounded-sm outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="font-display text-h3 text-ink underline-offset-4 group-hover:underline">
                    {maker.displayName}
                  </span>
                  <span className="font-text text-caption uppercase tracking-[0.04em] text-muted">
                    {[maker.craft, maker.location].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </main>
  );
}
