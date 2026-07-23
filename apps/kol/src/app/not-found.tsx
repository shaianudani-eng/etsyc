import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Branded 404 — same voice and geometry as the landing page, so a mistyped
 * URL still feels like KOL rather than a framework default.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-page flex-col justify-center gap-[var(--space-4)] px-[var(--space-2)] md:px-[var(--space-6)]">
      <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
        KOL · 404
      </p>
      <h1 className="max-w-[18ch] font-display text-display-hero [text-wrap:balance]">
        This door isn&rsquo;t on the map.
      </h1>
      <p className="max-w-measure text-body-lg text-muted">
        The page you&rsquo;re after doesn&rsquo;t exist — but the makers are
        exactly where you left them.
      </p>
      <Link
        href="/feed"
        className={cn(buttonVariants({ variant: "accent" }), "min-h-11 w-fit px-6")}
      >
        Back to the makers
      </Link>
    </main>
  );
}
