import { Skeleton, SkeletonLines } from "@/components/states/Skeleton";

/**
 * World route loading — a skeleton matched to the world's real opening
 * geometry (hero film frame in the centre column, first body block
 * beneath), never a spinner. Space is reserved at the film's real aspect
 * so the unfold starts with zero layout shift when the config resolves
 * (§0.3 house rules; CLS 0).
 *
 * This file is also a Suspense boundary, so the shell — and the status
 * code — flushes before anything under it resolves. That is why a missing
 * world's 404 is thrown from layout.tsx, ABOVE this boundary, and not from
 * the page. Deleting this file would fix the status code too; it would also
 * cost the world its opening geometry. Don't.
 */
export default function WorldLoading() {
  return (
    <div
      aria-busy="true"
      className="flex min-h-screen flex-col gap-[var(--space-section)] bg-ground pb-[var(--space-section)]"
    >
      <div className="mx-auto w-full max-w-page px-[var(--space-2)] md:px-[var(--space-6)]">
        {/* the hero film frame — center-column default rect */}
        <Skeleton className="mx-auto aspect-video w-full rounded-lg md:w-[72%]" />
      </div>
      <div className="mx-auto w-full max-w-page px-[var(--space-2)] md:px-[var(--space-6)]">
        {/* first world-body block: media-leads-text craft-story geometry */}
        <div className="grid gap-[var(--space-4)] md:grid-cols-2">
          <Skeleton className="aspect-[4/5] w-full rounded-md" />
          <div className="flex flex-col justify-center gap-[var(--space-2)]">
            <Skeleton className="h-8 w-3/4" />
            <SkeletonLines lines={4} />
          </div>
        </div>
      </div>
    </div>
  );
}
