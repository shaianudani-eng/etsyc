# KOL — every shop is a maker's world

A video-native marketplace: real makers on film, not a product grid. Visitors watch letterpress printers, leatherworkers, glassblowers, and woodturners at work, step inside their worlds, and buy straight from the bench.

**Live:** [etsyc.vercel.app](https://etsyc.vercel.app)

## The product

| Surface | Route | What it is |
|---------|-------|-----------|
| Landing | `/` | Brand front door + live maker index |
| Discovery feed | `/feed` | The magazine — engine-selected maker films, tap to grow |
| A maker's world | `/w/[handle]` | Deep-linkable, seller-themed world with products and story |
| Sign in / join | `/sign-in` | Passwordless email code (OTP) |
| Seller dashboard | `/seller` | Role-gated; clips, products, tagging |

## Stack & layout

- **App:** [`apps/kol`](apps/kol) — Next.js 16 (App Router), React 19, TypeScript strict, Tailwind
- **Database:** Supabase — schema in [`supabase/migrations`](supabase/migrations) (16 migrations), demo data in [`supabase/seed`](supabase/seed); RLS is the trust boundary
- **Video engine:** `apps/kol/src/lib/engine` — eligibility → scoring → anti-repetition pipeline ([spec](docs/03-system-design/KOL-video-engine-spec.md))
- **Hosting:** Vercel, production branch `deploy/canonical`

## Develop

```bash
cd apps/kol
pnpm install
cp .env.example .env.local   # fill in Supabase keys + ENGINE_COOKIE_SECRET
pnpm dev
```

```bash
pnpm typecheck && pnpm test   # 875+ unit tests; live-* suites need real DB keys
```

Design docs and specs live in [`docs/03-system-design`](docs/03-system-design); session logs in [`docs/08-agents_work`](docs/08-agents_work).

## The agent system

This repo also carries the autonomous C-suite agent kit that builds KOL (CEO → C-suite → workers, QA-tiered merges, worktree isolation). See [CLAUDE.md](CLAUDE.md) for the operating contract, [AGENTS.md](AGENTS.md) for the routing table, and [TEMPLATE-USAGE.md](TEMPLATE-USAGE.md) for reusing the kit in another project. The pre-2026-05-25 kit is archived at `.archive/pre-beamix-bundle-2026-05-25/`.

## License

MIT — see [LICENSE](LICENSE).
