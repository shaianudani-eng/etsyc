import type { Metadata } from "next";
import Link from "next/link";
import { ReviewsBlock } from "@/components/blocks/reviews";
import type { BlockState } from "@/components/blocks/shared";
import { customStore } from "@/lib/store-config/fixtures/custom";
import { matrixBlocksFor, previewReviews } from "@/lib/store-config/fixtures/preview-blocks";
import { senaStore } from "@/lib/store-config/fixtures/sena";
import { renderBlock, renderStore } from "@/lib/renderer/render-store";
import { themeStyle } from "@/lib/theme/apply-theme";
import { cn } from "@/lib/utils";

// Internal review surface — never in the index (robots.ts also disallows it).
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATES: BlockState[] = ["success", "loading", "empty", "error"];

/**
 * /preview — the critic's screenshot surface.
 *  1. The full world through renderStore (success), for the selected fixture
 *     (?fixture=sena|custom — curated vs any-hex custom theme path).
 *  2. A 4-state matrix: every catalog block type in success / loading /
 *     empty (seller preview) / error, inside the SELECTED fixture's theme —
 *     so both theme.kind paths (curated / custom any-hex) get full coverage.
 */
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string; statement?: string }>;
}) {
  const { fixture, statement } = await searchParams;
  const authored = fixture === "custom" ? customStore : senaStore;
  // ?statement=off — the E5 eyes-on toggle: both hero variants (statement
  // display line + name-led caption vs the name holding the display tier)
  // must be viewable at world scale under a real theme. Strips the
  // AUTHORED statement; it never fabricates one (D10).
  const config =
    statement === "off"
      ? {
          ...authored,
          blocks: authored.blocks.map((block) =>
            block.type === "hero-video"
              ? { ...block, props: { ...block.props, statement: undefined } }
              : block,
          ),
        }
      : authored;
  const matrixBlocks = matrixBlocksFor(config);
  const matrixData = {
    maker: config.maker,
    media: config.media,
    products: config.products,
    voiceovers: config.voiceovers,
  };

  return (
    <main className="min-h-screen bg-ground">
      {/* preview chrome — KOL's own fixed identity, outside any world root.
          Static (not sticky): review chrome must never overlay the world's
          hero type it exists to screenshot. */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-3 px-[var(--space-2)] py-3 md:px-[var(--space-6)]">
          <p className="font-text text-caption uppercase tracking-[0.08em] text-muted">
            KOL preview · {config.maker.displayName} · theme:{config.theme.kind}
            {config.theme.kind === "curated" ? ` (${config.theme.paletteId})` : " (any-hex)"}
          </p>
          <nav aria-label="Fixture" className="flex flex-wrap gap-2">
            <FixtureLink href="/preview" active={fixture !== "custom"}>
              sena · curated
            </FixtureLink>
            <FixtureLink href="/preview?fixture=custom" active={fixture === "custom"}>
              noor · custom
            </FixtureLink>
            {/* E5 hero variants — statement present (authored) vs absent */}
            <FixtureLink
              href={fixture === "custom" ? "/preview?fixture=custom" : "/preview"}
              active={statement !== "off"}
            >
              statement
            </FixtureLink>
            <FixtureLink
              href={
                fixture === "custom"
                  ? "/preview?fixture=custom&statement=off"
                  : "/preview?statement=off"
              }
              active={statement === "off"}
            >
              name only
            </FixtureLink>
          </nav>
        </div>
      </header>

      {/* 1 · the world, whole, through the one renderer. isPreview also
          mounts the stage rail — walk FEED→…→NARRATE_SHRINK and watch the
          hero film survive every transition (P4 invariant). */}
      <section id="world" aria-label="Rendered world">
        {renderStore(config, { isPreview: true })}
      </section>

      {/* 2 · the 4-state matrix — every block type, every state */}
      <section
        id="state-matrix"
        aria-label="Block state matrix"
        className="border-t-4 border-line"
        style={themeStyle(config.theme)}
      >
        <div className="mx-auto w-full max-w-page px-[var(--space-2)] py-[var(--space-8)] md:px-[var(--space-6)]">
          <h2 className="font-display text-h1">
            Block × state matrix · theme:{config.theme.kind}
          </h2>
          <p className="mt-2 max-w-measure text-body text-muted">
            All 11 catalog blocks in all 4 mandatory states. &ldquo;Empty&rdquo; renders the
            seller-preview ghost prompt; in a live world truly-empty optional blocks are omitted
            entirely. Hero/reel film files land with the D12 team footage — their posters and
            quiet fallbacks are the designed loading/error behavior, not a gap.
          </p>
        </div>
        <div className="space-y-[var(--space-8)] pb-[var(--space-16)]">
          {matrixBlocks.map((block) => (
            <article key={block.id} className="mx-auto w-full max-w-page px-[var(--space-2)] md:px-[var(--space-6)]">
              <h3 className="mb-[var(--space-2)] font-mono text-caption uppercase tracking-[0.08em] text-muted">
                {block.type} · {block.variant}
              </h3>
              <div className="grid gap-[var(--space-2)] xl:grid-cols-2">
                {STATES.map((state) => (
                  <div key={state} className="overflow-hidden rounded-md border border-line">
                    <p className="border-b border-line bg-surface px-3 py-1.5 font-mono text-caption text-muted">
                      {state}
                      {state === "empty" ? " (seller preview)" : ""}
                    </p>
                    <div className="bg-ground py-[var(--space-4)]">
                      {block.type === "reviews" ? (
                        <ReviewsBlock
                          block={block}
                          data={matrixData}
                          state={state}
                          entries={state === "empty" ? [] : previewReviews}
                        />
                      ) : (
                        renderBlock(block, matrixData, state, true)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function FixtureLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-pill border px-4 text-caption uppercase tracking-[0.04em] transition-colors duration-state ease-kol",
        active
          ? "border-transparent bg-ink text-ground"
          : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
