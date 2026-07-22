import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";

/**
 * Public landing — KOL's front door (fixed sunbaked identity, D15a).
 * Routes stay honest: every CTA leads to a live surface — the discovery
 * feed (W3-B1a public front door), sign-in, or the seller gate (P1).
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-page flex-col justify-center gap-[var(--space-4)] px-[var(--space-2)] md:px-[var(--space-6)]">
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        KOL · A marketplace of makers
      </p>
      <h1 className="max-w-[16ch] font-display text-display-hero [text-wrap:balance]">
        Every shop is a maker&rsquo;s world.
      </h1>
      <p className="max-w-measure text-body-lg text-muted">
        Watch letterpress printers, leatherworkers, glassblowers, and
        woodturners at work — then step inside their worlds and buy what they
        make, straight from the bench.
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
          className="inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-6 py-2.5 text-ink transition-colors duration-state ease-kol hover:bg-ground active:scale-[0.98]"
        >
          Sign in
        </Link>
      </div>
      <Link
        href="/seller"
        className="w-fit font-text text-caption uppercase tracking-[0.04em] text-muted underline-offset-4 hover:underline"
      >
        Are you a maker? Open your world
      </Link>
    </main>
  );
}
