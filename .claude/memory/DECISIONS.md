# Architecture & Strategy Decisions
*Append-only. 50-entry cap — archive to `DECISIONS_ARCHIVE.md` when full.*

> Empty template. Every C-suite agent appends one entry per significant decision
> using the format below. Workers do not write here.

## 2026-07-22 — Gate-2 design rulings: optical properties are not numbers, and an anti-grid rule is not an anti-cycle rule

**Context:** The first design-critic pass measured the built product at pixel level across ten captures. It confirmed the hardest Wave-3 call (light display weight over film) and found three places the direction itself — authored without ever running `/preview` — was wrong.

**R1 — the nameplate register is stroke-contrast-aware (replaces the flat `weight 700`).** Same weight, same tier, opposite outcomes: Fraunces reads airy, a geometric sans reads as a logotype stamped on the face. Optical mass is size × weight × **stroke contrast**, so the spec now declares `strokeClass` per pairing and the renderer reads `--nameplate-size/-weight/-tracking`, never a font name (`kind:"custom"` defaults to `uniform`, the lower-mass fail-safe). `modulated` → `display-hero`/700/`-0.03em`; `uniform` → `display`/600/`-0.025em`. Two axes, not one: **statement larger-and-lighter, nameplate smaller-and-heavier**, so nameplate-vs-speech survives any face. Dissolves the standing §2.1 ↔ §3.2 contradiction.

**R2 — the feed gets a mobile identity, carried by the left edge.** The spec was silent below 768 px and mobile rendered eight identical-width cards with uniform gaps: the equal-cell layout §2.4 bans, one column wide. Width equality is what reads as a grid; aspect alternation cannot fix it. Two columns rejected — it shrinks the maker's face. Four mobile slots vary inset asymmetrically, one bleeds both margins, and **each caption aligns to its own media's left edge** so the text column zig-zags.

**R3 — slot assignment is content-aware, not cyclic.** S1→S2→S3 repeated 3.6× at N=18 while passing both anti-grid assertions — a deterministic cycle is a grid with a longer period. Cards now choose slots by aspect fit + repeat/edge penalties under four hard constraints, deterministic, degrading to centre focal point if the `focalPoint` schema add has not landed. Added a 6th slot (`COLUMN`) and a 3rd assertion: **no ordered 3-card slot sequence more than twice, ≥ 4 distinct row patterns.** The anti-grid AC was necessary and insufficient.

**Also bound — contrast carries headroom.** Every number this wave was measured on a zero-variance synthetic gradient; hollowgrain's caption at 4.89:1 has 0.39 of margin and a lit face takes it under. Type over film must now measure **≥ 5.5:1 body / ≥ 4.0:1 large** — a full point over the I5 floor. I5 unchanged; this is a stricter measurement condition on media surfaces. Variance-aware scrim (contrast against `mean + 1.5σ`, sampled at ingest) recommended for Wave 4/5.

**Reversibility:** reversible (spec text; no data or schema change)
**Owner:** design-lead
**Affects:** B1b (feed layout — R2, R3), B3 (hero nameplate — R1), QA-Lead (three new ACs), KOL-design-system §3 (must mirror `strokeClass`)
**Status:** Binding. B1b and B3 fix briefs carry it.

## 2026-07-22 — E5 hero-line ruling: a maker's NAME is identity, not her words (unblocks B3)

**Context:** Gate 1 filed E5 — screen-specs §3.2 and world-unfold's binding AC both said an absent `statement` leaves the world with **no hero line at all**, while the shipped `hero-video` render (pre-dating Wave 3) puts `maker.displayName` in that slot at `--fs-display-hero`. Two independent reviewers had already cleared the code as in-scope and non-D10. So this was never a defect — it was a product decision nobody had made, and B3's completion bar cited the text that contradicts what ships.

**Decision — the hero frame is never nameless; the name only changes tier.** Exactly one display-tier line per world in both cases. `statement` present → statement holds display tier (weight 400–500, `-0.01em`) and `maker.displayName` **leads the caption line directly beneath it**, with `showCraftLine` true or false. `statement` absent → `maker.displayName` holds display tier (weight 700, `-0.03em`, the shipped render, unchanged). The weight/tracking split is the load-bearing part: bold-and-tight reads as a **nameplate**, light-and-open reads as **speech**, so the name is never read as words the maker said.

**Why the name is not a D10 fallback:** `maker.displayName` is **stored identity, not attributed speech**. D10 bans *fabricating words in a maker's voice*; naming the human is the product's promise, not a fabrication of it. The three §3.2 bans (generated line / promoted craft line / store name) stand unchanged — nothing is ever promoted into the display tier **as the maker's words**.

**Why identity never yields to voice (the half nobody had ruled):** B3 is deep-linkable. A buyer landing cold — no feed, no `GROWN` pass at the name — would read *"Vessels blown in one breath"* and be unable to name the person whose world they are in. An **unattributed** statement is the weaker D10 posture, not the stronger one. Platform owns attribution; seller owns the words (D15: *"the platform owns time and space, the seller owns light and voice"* — a name is neither light nor voice).

**Seed reality:** all 4 seeded makers authored statements (25–29 chars), so the absent path is unexercised by seed data. **Seeds are NOT changed** — the four worlds are the competition demo and a nameplate world is the strictly weaker impression. The path is exercised by fixture instead: unit tests already cover it, and the B3 eyes-on gate must toggle a `/preview` fixture's `statement` off and view both worlds.

**Eyes-on gate (does not block dispatch, blocks merge):** the statement-present caption line is a **new visual change to a shipped surface** (`hero-video/index.tsx`), and Design-Lead's direction was code-read, never `/preview`'d. Both hero variants must be viewed at world scale under a real theme before B3 merges — crowding at the bottom-left inset and `--on-media`/`--scrim` contrast on the caption line are the two failure modes. Third such gate filed this wave.

**Files changed:** `docs/06-design/KOL-wave3-screen-specs.md` §3.2 (rewritten), `docs/04-features/specs/world-unfold.md` (AC block + changelog), `docs/04-features/KOL-block-catalog.md` (hero-video props + Success state), `docs/06-design/KOL-wave3-design-direction.md` §display-budget table row.
**Reversibility:** reversible (spec text + one caption-line render). **Owner:** cpo (`cpo-e5-heroline`). **Affects:** B3 (dispatch-blocking), B2 §2.2 (same two-tier read), B5 dock chrome, `hero-video.test.tsx` (one new assertion, one amended), QA-Lead's B3 completion bar.

## 2026-07-22 — Engine cookie names are a single source of truth (buyer-journey seam)

**Context:** Three T1 units independently invented cookie names for the same two values — B1a `kol_sid`/`kol_ring`, B4 `kol_session`/`kol_ring`, B5 `kol_sid`/`kol_film_ring`. Each was green in isolation. Together they fragment buyer identity across the journey.

**Why it matters (silent, not cosmetic):** a buyer scrolls the feed under one session id, taps into a world, and a different cookie is read. The seeded jitter changes AND the anti-repetition ring does not carry — so the buyer is shown clips they just watched, on the one surface whose whole promise is that it remembers them. Same class as the Gate-1 defect where FILM-LAYER silently voided P3-EXT's `focalPoint`: two correct units that break on contact.

**Decision — canonical, binding on every buyer-journey unit:**
- **Session cookie: `kol_sid`** · **Ring cookie: `kol_ring`** (B1a's values; B1a owns session identity per packet §7).
- **Declared in exactly one place each** — `lib/feed/session.ts` (`FEED_SESSION_COOKIE`) and `lib/feed/select.ts` (`FEED_RING_COOKIE`). **Every other consumer imports; nobody re-declares.** Two independently-declared constants that agree today drift the moment one is renamed.
- Buyer-journey units branch from / rebase onto `feat/b1a-feed-data`, which is already the base for B1b and B4.
- **RSC cannot write cookies.** The session id is minted by proxy middleware; the ring is read-only during render. That is load-bearing, not a workaround — a ring persisted at render time would break the "same `sessionId` → same order" AC by excluding just-shown clips on reload.

**AMENDMENT (2026-07-22, Gate 2) — the rule must cover ATTRIBUTES, not just names.** Converging the two cookie *names* to one declaration each was necessary and **insufficient**. Gate 2's adversary found B5 writing both cookies **without `secure`** while every other writer set `secure: NODE_ENV === "production"`. Cookie identity is `(name, domain, path)` — **`Secure` is not part of the key** — so that write *replaced* the middleware's cookie and stripped the attribute, putting an HMAC-bearing ring on plaintext `http://` in production. B5 had imported the canonical names; it reimplemented the behaviour. **Matching identifiers, divergent semantics.**

Therefore: **the attribute set is part of the contract and gets the same single-declaration treatment as the names.** Export one `ENGINE_COOKIE_OPTIONS` (httpOnly · sameSite lax · path / · secure in production) from `lib/feed` beside the constants; every writer imports it. Make it a **function**, not a module const, so `NODE_ENV` resolves at write time. Assert it with `toEqual`, never `toMatchObject` — a subset match cannot detect a *missing* attribute, which is exactly how this slipped past a passing suite.

**Generalised rule:** when a value is a cross-unit contract, the whole shape is the contract. Converging the name while leaving the semantics to each caller reproduces the defect with a longer fuse.

**Applies to:** B1a, B1b, B2, B4, B5, B6, B7, B8 and every later engine consumer. **Gate 2 verifies convergence across all branches before merge.**

**Reversibility:** reversible (constants + imports). **Owner:** ceo. **Affects:** every unit that calls `createEngineDeps`.

## 2026-07-22 — Wave-3 Gate 1: two Irreversible migrations, and the "RLS gates rows, not values" class

**Context:** Wave-3 T0a (W2-WIRE, FILM-LAYER, P3-EXT, SEED-W3) went through a 5-reviewer Full-tier panel. Three BLOCKed, six P1s. Two of the P1s were the same root cause the project has now hit twice.

**The class, stated once so it stops recurring:** **RLS gates *which rows* a principal may write; it says nothing about *what values* go in them.** MIG-CHECK closed this for tag columns (Wave 2). Gate 1 found it open on timestamps: `created_at` was client-settable on 11 tables. W2-WIRE's F3 fix then weaponised it — bounding the feed to `FEED_CANDIDATE_CAP=300` most-recently-tagged clips turned `created_at` from a ranking *bias* into a membership *gate*, so a seller inserting 300 rows dated `2099-01-01` **permanently evicts every other maker from discovery** (a future date never rotates out; `rank.ts` then clamps it to `ageDays=0` = permanent max freshness). Confirmed live by the CEO before acceptance. **Any new column that a read path orders, ranks, or gates on must be server-enforced at the DB, not validated in the app.**

**Decisions:**
1. **MIG-TS applied** (Irreversible, Founder-signed) — `enforce_server_timestamps()` BEFORE INSERT OR UPDATE on 11 tables (`videos, video_profiles, stores, store_versions, products, reviews, media, profiles, carts, commissions, threads`). INSERT forces `now()`; UPDATE preserves `OLD.created_at`; `auth.role()='service_role'` bypasses (§B0 escape hatch — SEED idempotence depends on it). Proven live: forged 2099 INSERT → `now()`; forged UPDATE → unchanged; service-role explicit timestamps preserved; SEED-W3 re-run `12× INSERT 0 0` with identical per-table md5.
2. **Mechanism is a trigger, NOT a column-grant revoke** (QA-Lead ruling) — column-list grants silently break every future `ADD COLUMN` and reject benign echo-back upserts.
3. **`updated_at` deliberately excluded** — no read path consumes it, forcing it is a write-semantics change deserving its own sign-off, and 3 of 11 tables lack the column. Revisit the moment a read path keys on it.
4. **Gate-1 partial merge authorized** — P3-EXT + SEED-W3 merged; FILM-LAYER + W2-WIRE held for fix cycle 1 of 2.
5. **Migrations gate the *read side*, not the merge** (MIG-CHECK precedent, reaffirmed): the vector exists on staging independent of what is on `main`, so holding certified branches buys nothing. MIG-TS is a **T1 entry gate**.

**Z-order stacking contract (binding on every Wave-3+ buyer surface).** The Film Layer is one `position:fixed` player at app root, so page-level chrome no longer wins by default — a rewrite silently painted the film over the hero `h1`, craft line and `.kol-scrim`, losing a Wave-0 visual guarantee that jsdom cannot see. Resolved with three root-level bands, written into `globals.css`:

`--z-film-bed: 30` (undocked film, above world flow) < `--z-film-chrome: 35` (`.kol-hero-stage` lifts heading/craft/scrim over the film; the claimed slot becomes a transparent window) < `--z-film: 40` (docked corner card; `data-film-docked` flips planes **at claim time** so the whole dock flight rides the top plane). App chrome stays >= 50.

**Mechanism is lift-chrome, NOT portal-into-layer** — portalling would rip the `h1` out of the world's heading/accessibility order and drag chrome into the docked corner. **B1b, B3, B4 and B5 lift their chrome the same way and must keep the ancestor chain free of intervening stacking contexts.**

**Process finding worth keeping:** three of the six P1s were guards that existed with *nothing pinning them* — a zero-delta FLIP whose `data-film-edge` telemetry claimed success, `focalPoint` tested only in a mode production never runs, and an anon-client boundary provable only on keyed machines. **Mutation verification is now the standard for any fix to a load-bearing guard**: break it, watch the test go red, restore, report it. Two units did exactly that this gate.

**Open follow-ups (do not drop):** `verifications.created_at` is client-settable on INSERT — the CEO's exclusion scope was one-sided (checked UPDATE policies only); outside MIG-TS's signed scope, needs a decision. F12 module-scope `createClient` still defeats `describe.skipIf` in 5 live suites on `main`. G1-F2 cross-aspect FLIP smear rides now but becomes P1 at Gate 2 if unaddressed (it sits on B2's flagship grow edge). Maker-name-vs-`statement` hero line needs a CPO + Design-Lead written ruling before B3 dispatches.

**Reversibility:** hard (triggers applied to live staging; rollback in the migration header). **Owner:** ceo (`ceo-1-1784669503`). **Affects:** every Wave-3+ builder, and any future migration touching a ranked column.

## 2026-07-21 — Wave-3 AC rulings: film-frame continuity, Focus Film, two additive schema fields

**Context:** Design-Lead's Wave-3 direction (code-read, not eyes-on — no `/preview` in its worktree) surfaced that two binding ACs in shipped specs were unsatisfiable or wrong, plus two store-config gaps. AC ownership is CPO's; CEO routed rather than deciding.
**Decisions (all APPROVED, one with changes):**
1. **Film-frame continuity replaces "single `<video>`, `paused` never true"** (B2 `grow-interaction.md`, inherited by B3/B4/B5). The old AC could not be satisfied by any implementation that also honoured the spec's own clip-swap requirements — a `src` change necessarily pauses. The shared element is now the **frame**, not the node, and the AC splits: same-source transitions (`grow`/`ungrow`/`unfold`/`dock`/`undock`) require true element persistence and **forbid cross-fading**; source-changing swaps get an in-frame cross-fade at `--dur-swap` with the incoming buffer at `readyState >= 3` **and already playing** before the fade. The split is the load-bearing part — without it "cross-fade" becomes a general escape hatch and the shared-element promise dies quietly.
2. **Focus Film model adopted** (B1 `discovery-feed.md`). "Muted autoplaying film across mixed-size cards" (plural) is replaced by one shared Film Layer on the viewport-centre card + ≥1 ambient neighbour loop + focalPoint-cropped poster stills. It cannot weaken the anti-grid gate because it does not touch layout; the anti-grid guarantee moves entirely onto composition, where it belonged (TikTok Shop's five autoplaying clips are still a grid). Added the adjacent-`getBoundingClientRect().top`-within-24px assertion, which is what actually catches a grid. Added a floor criterion: ≥2 cards showing motion whenever ≥2 cards are in view — one moving card among seventeen stills is a photo catalogue.
3. **store-config v1.3 amended, additively, no version bump.** `media.clips[].focalPoint {x,y}` optional/default 0.5,0.5 (deliberately unlike the *required* `images[].focalPoint` — optional is what keeps existing configs valid); `hero-video.props.statement?: string` ≤48 chars, maker-authored, **no render-time fallback** (D10). `schemaVersion` stays `"1.3"` — it is a `z.literal` in the validator, so a bump would invalidate every stored config.
**Also:** feed engine limit fixed at **18** (closed B1 OQ-2). `impact-stat` confirmed as a Wave-6 `craft-story` sub-slot, catalog stays at 11. D10 line drawn precisely: AI *suggestion at authoring time with maker approval* is permitted (D10 allows AI-assist on store text, recorded in `aiTransparency.aiAssistedFields`); AI *fabrication at render time* is banned. Without that distinction "maker-authored only" would have contradicted D10 and the existing AI pipeline.
**Not verified visually — two eyes-on gates filed rather than approved on inference:** `--dur-swap: 120 ms` must be reviewed frame-by-frame on a real clip pair before B4 merges (B2 OQ-2); the feed must be design-critic'd at N=4 and N=18 for "alive with people" before B1 merges (B1 OQ-3). If the feed reads dead, the dial is the ambient-loop count, not the Focus Film model.
**Reversibility:** reversible (spec text + optional schema fields). **Owner:** cpo (`cpo-wave3-ac-rulings`). **Affects:** every Wave-3 brief (B1–B5), P3 validator (`schema.ts`/`types.ts`/fixtures/tests), P4 renderer (clip focalPoint crop + statement render), AI pipeline (may suggest `statement`, must never emit it unapproved).
## 2026-07-21 — Management-API SQL under an org-wide PAT is FORBIDDEN in committed automation (SEED must-fix)

**Context:** Security review BLOCKED the SEED branch over `scripts/seed-blocks.sh` (seed SQL itself certified clean). The script applied the seed via the Management API `/database/query` endpoint — executes as `postgres` superuser, authenticated by an **org-wide PAT** (create/delete projects, rotate every key) — where the brief authorized only a project-scoped service-role write. That is a standing arbitrary-SQL capability in the repo: reviewers treat `.sql` seeds as inert, so a later seed edit would run as superuser under normal review. It also passed the PAT in curl `argv` (world-readable via `ps -ef`) and `set -a; source`d `.env.local`, exporting the service-role key and DB password into every child process.
**Decision:** Management-API `/database/query` as `postgres` under an org-wide PAT is **FORBIDDEN in committed automation.** Repo scripts use least privilege — project-scoped service-role, or `psql` with a scoped connection string. Secrets never in `argv`, never `set -a` exported. Break-glass is a documented manual runbook only, at Irreversible floor with Founder sign-off. Script deleted; the sanctioned apply path is now the manual runbook in the header of `supabase/seed/001_blocks_catalog.sql`.
**Known gap:** neither `psql` nor the Supabase CLI is installed on the dev machine — that absence drove the original Management-API escalation, and the next engineer will hit the same wall. Install `psql` (`brew install libpq`) before the next manual apply.
**Reversibility:** reversible (policy), but re-introducing such a script is Irreversible-floor + Founder sign-off by this ruling.
**Owner:** devops-engineer (QA-Lead ruling, SEED branch)
**Affects:** all workers writing repo automation that touches the DB — database-engineer, devops-engineer, backend-engineer; QA/security reviewers (review floor for any DB-executing script)

## 2026-07-21 — Wave 1 backend live: 31-table schema applied + P1 auth merged

**Context:** First DB wave of the KOL MVP. Founder provided Supabase keys for the KOL staging project (ref `olwtcjzmohdhawdzlzqs`); no Docker on host + Free-plan 2-active-project cap meant no disposable throwaway, so validated+applied directly on the empty staging project with Founder sign-off.
**Decision / what shipped (all on main, pushed):**
- **MIG-STAGE** (QA PASS Full) — `supabase/` scaffold, 13 migrations staged, `@supabase/ssr` client layer (browser/server/service-role server-only/middleware).
- **MIG-APPLY** (Irreversible, Founder-signed) — 31-table schema applied to staging, RLS on all 31; **9/9 security validation PASS** after a group-14 fix (Supabase default-privileges pre-grant `anon` EXECUTE; `revoke from public` doesn't cover it → added explicit `revoke execute from anon` on the 3 write RPCs + trigger fns + a default-privileges policy). Independently re-verified live by adv-migapply. Real gen-types committed.
- **P1 Auth** (Irreversible, Founder-signed @ `22ce96e`) — email/OTP, role forced `buyer` by DB trigger (live-verified), role-gated routing, service-role server-only.
**Security lessons (load-bearing):** (1) live 9-point validation catches what static review can't — the anon-EXECUTE default-privilege gap was invisible to static SQL review. (2) P1 QA caught TWO distinct open-redirect vectors (control-char `/%09//`, dot-segment `/..//`) that a single review pass would have shipped; the robust fix re-validates the redirect guard's OUTPUT (re-parse), closing the class. Future auth adversary briefs must include URL-parser normalization payloads.
**New convention:** default privileges now grant NO implicit anon EXECUTE — any future anon-callable RPC needs its own explicit `grant execute ... to anon` (the get_public_profile pattern).
**Reversibility:** hard (schema applied to real staging; auth on main). **Owner:** ceo (`ceo-phase6`). **Affects:** P2 (next, last Wave-1 unit) + all Wave 2-6 builders. Env: keys in `apps/kol/.env.local` (gitignored). Launch prompt: `docs/08-agents_work/handoffs/2026-07-21-FULL-MVP-BUILD-LAUNCH-PROMPT.md`.

## 2026-07-21 — Phase-6 Wave 0 (render spine) shipped to main; ≥300-LOC→Full tier rule established

**Context:** First real build wave of the KOL MVP — the store-config render spine (mock-fixture only, zero DB), built to harden the apps/kol scaffold to spec.
**Decision:** 4 units (P3 store-config v1.3 validator · P4 renderer w/ hero-persistence · P5 block library · P8 design rails + reusable WCAG module) built by one Fable Design-Build agent each, QA'd independently at Full tier, merged to GitHub main @ `32cbeb8` (309/309 tests, typecheck, prod build green). Orchestration on Opus, all build/QA on Fable 5.
**Tier precedent (reusable):** QA-Lead ruled ≥300 LOC changed → **Full tier regardless of surface** (auth/DB/billing not required to trigger it); Full = code-reviewer + qa-engineer + security-engineer + adversary-engineer. CEO must run the reviewers, never let QA-Lead simulate a skipped one — this session added adversary passes when a QA-Lead flagged that gap.
**Gate proved its value:** QA caught + forced fixes on two stored-injection vectors (javascript:/data: URLs + CSS font-family breakout in P3), a P5 AA failure (3.32:1), and — via the integration smoke test — a P3 fontFamilyName regex that was ASCII-only and rejected Unicode foundry names (D15 violation), broadened to `\p{L}\p{M}\p{N}` with the injection block intact.
**Reversibility:** merged (hard to reverse; on origin/main). **Owner:** ceo (session `ceo-phase6`). **Affects:** all Wave 1–6 builders — they extend this spine. Migration apply is the one item gating Wave 1 (Founder-gated, blocked on Docker-vs-cloud + staging keys). Full MVP launch prompt: `docs/08-agents_work/handoffs/2026-07-21-FULL-MVP-BUILD-LAUNCH-PROMPT.md`.

---

## Format

```markdown
## YYYY-MM-DD — [Decision title]

**Context:** Why this came up.
**Options considered:** A / B / C with one-line trade-offs.
**Decision:** What we chose.
**Rationale:** Why this option won.
**Reversibility:** reversible | hard-to-reverse | irreversible
**Owner:** [agent name]
**Affects:** [list of agents / domains downstream]
```

---

<!-- Entries below this line, most-recent first. -->

## 2026-07-20 — Phase 5 COMPLETE: 32 build-ready per-feature specs (40 MVP features), CPO+CTO BUILD-READY

**Context:** Per the Phase-5 handoff, turn the ~39-feature tree into build-ready specs in `docs/04-features/specs/` before Phase-6 build. Ran the T2 dispatch-packet model on Opus: CPO briefs + CTO data-contract/risk map → 5 parallel technical-writer workers → CPO+CTO build-ready review → surgical fix pass → merge.
**Delivered:** 32 specs (~9,057 LOC) covering all 40 MVP features (hybrid granularity — store-engine spine as one pack; buyer/seller/trust per-feature), each filling `_TEMPLATE.md`, D#-traceable, all-4-states, bound to real Phase-4 tables/RPCs, overlaps policed. Plus the consolidated dispatch packet (`docs/08-agents_work/handoffs/2026-07-20-phase5-dispatch-packet.md`) as the durable source-of-truth.
**Both chiefs signed BUILD-READY** (CTO: 0 P1 technical errors). **Risk tiers (CTO-authoritative):** P1/P3 Irreversible · P4/P5/P6/P7 Full · P8 Lite · P12 Full/Lite; §B1 had under-tiered P3/P4/P5, ratified to §A3.
**Founder decisions (Adam):** (1) deferred hardening gaps N2/N3/N4/NEW-3 → ACCEPT ALL for seeded MVP, schedule post-launch (each fix = Irreversible migration); (2) B11 search scope (first-wave vs fast-follow) → decide at Phase-6 planning.
**Carried to Phase 6:** RICE effort uncomputed on 14 spine/buyer-core features (needs CTO estimates; not a blocker); voice-anchor verification mechanism (S9) unspecified — gates Real-Maker badge + publish precondition (c); B11 delivery-filter field undefined. **Build order:** P1→P3→P5-seed→P4; P7→P6→B1–B8; **P15 before B12/B14**; P9→S6/P10 publish; S9→S6(c)/P11; B7→B6+/B9; S8→B6/B7.
**Reversibility:** hard-to-reverse (specs gate all Phase-6 build). **Owner:** ceo (`ceo-phase5`). **Affects:** all Phase-6 Design-Build (Fable) + QA agents; database-engineer (migration order); Founder (deferred migration apply is still untouched). Merged to main, Founder-confirmed.

## 2026-07-20 — Phase 3 formally CLOSED: design gate run + v2 reconcile + apps/kol scaffolded (QA-Lead PASS)

**Context:** Pre-Phase-5 audit found Phase 3 was never truly *done* — its master-plan gate (design-critic loop + QA-Lead PASS) was never run (only docs existed), and the "coded component library shell" deliverable was unbuilt. Founder chose to close both now.
**What the gate caught (load-bearing):** (1) the store-config schema still carried the **rejected v1** palette/pairing names + only 3 motion presets — never synced when design-system was rewritten to **v2**; the AI-pipeline spec had the same stale enums. Both would have hard-blocked every Phase-6 builder. (2) A **Tailwind alpha-modifier bug** in the scaffold silently emitted no CSS for every `/opacity` utility (illegible hero over film, invisible controls/hover) — a green build hid it; only the code + visual review caught it. (3) A **fabricated attributed maker quote** in the thank-you fallback (D10 violation on the product's core honesty claim).
**Decision / outcome:** **store-config.schema.md → v1.3** — curated enums synced to design-system v2 (`sunbaked·market-plum·cuberto-noir·orchard·bazaar` / `statement-grotesk·warm-serif·modern-mono-grotesk·character-maximal` / `hushed·fluid·liquid·dimensional`), block-grounds exposed with AA restrictions, `--accent-3`, optional maker-authored thank-you `message` field (D10). AI-pipeline spec synced. **`apps/kol` scaffolded** (Next 16/React 19/strict TS/Tailwind): 11 blocks × 4 states, `renderStore` for both `theme.kind`, curated (Sena) + custom (Noor any-hex) fixtures, `/preview`. Anti-slop AA guarantee made concrete: a per-palette+mode **AA-measured `--accent-cta` token** (all combos ≥4.5:1). **QA-Lead PASS** (Full tier) after 2 fix cycles. Scaffold is shell-only — no backend/auth/DB (mock fixtures).
**Reversibility:** hard (design system + store-config contract + app foundation are what Phase 5/6 build on). **Owner:** ceo (`ceo-6`). **Affects:** all Phase-5/6 build agents (build against apps/kol + store-config v1.3 + design-system v2); 7 tracked P3 follow-ups in `docs/08-agents_work/sessions/2026-07-20-qa-lead-kol-phase3-closure.md`. Merged to main, Founder-confirmed.

## 2026-07-19 — Phase 4 complete: KOL data model + AI-pipeline + video-engine specs (all QA-passed)

**Context:** Per the build-planning handoff, took KOL into Phase 4 of the master plan — fully specify the two technical spines (Supabase data model, AI/video engines) before any build. Ran schema-first (Founder choice), then AI-pipeline + video-engine specs in parallel. Orchestrated on Opus (spec/planning tier); Fable 5 reserved for Phase-6 build.
**Delivered (4 branches off `origin/main`, docs/plan only — NOTHING applied):**
- **Data model** (`feat/kol-p4-schema`): 31-table Supabase plan covering every feature-tree §1A–1D `Data need` incl. all D16 tables; RLS per table, buyer/seller/public split, Supabase Auth trigger, video-engine GIN + search tsvector/pg_trgm indexes. ADR-0001 + 13 non-applied SQL plan files. **Reviewed migration PLAN — the Founder applies manually after staging validation.**
- **AI co-creation pipeline** (`feat/kol-p4-ai-pipeline`): ADR-0002 + spec. Interview→extraction→brand→**custom per-shop design system (D15)**→store-config JSON→auto-critic→approval. Per-LLM-feature evals + cost logging (6 features).
- **Video engine** (`feat/kol-p4-video-engine`): ADR-0003 + spec. Unified eligibility→scoring→anti-repetition; state→query map for all 8 buyer states; thankyou-never-in-feed structural; AI-ranker upgrade slot; relationship-ranking from `buyer_signals` (per-buyer, not popularity). B/C share one eval-harness contract.
**Key decision — D15 made expressible (store-config §2.2, schemaVersion→1.1):** `theme` is now a `discriminatedUnion('kind',[curated|custom])`. `curated` = the existing enum (KOL's own UI + seller starting points); `custom` = seller-shop full freedom (any-hex 7-role palette + hosted-catalog font pairing). **The curated-enum invariant (old anti-slop layer-1) scopes to `kind:"curated"` ONLY; for `kind:"custom"` the load-bearing guarantee is the deterministic WCAG-AA contrast gate + auto-critic + maker approval** — a `custom` config must carry a passing `meta.criticScore` before leaving `draft`. This is the concrete mechanism that resolves the D15 freedom↔anti-slop tension.
**QA (schema = Irreversible tier):** 2 BLOCK cycles → PASS. Cycle-1 BLOCK (security+adversary+code-review, consolidated by QA-Lead): 5 P1 write/trust-integrity holes — root cause "RLS is the only boundary; app-side column allow-lists are bypassable via direct PostgREST." Fix cycle 1 moved all enforcement DB-side (10 SECURITY DEFINER fns, 6 triggers). Cycle-2 PASS-with-required-hardening (adversary caught unbounded anon `public_profiles` enumeration → replaced with id-keyed `get_public_profile()` fn; explicit `auth.role()='service_role'` replaces the null-uid footgun). Cycle-3 PASS. 4 P3s tracked as ADR "Post-MVP hardening." B/C specs = Lite QA PASS after one fix pass.
**GATE (do not skip):** the schema plan is **static-reviewed only** (no Supabase MCP). A **mandatory 9-point staging validation** (ADR-0001) MUST run before the Founder applies — apply-run on staging + anon/buyer/seller-JWT probes. Migration apply = Irreversible, Founder sign-off required; QA-Lead PASS does NOT authorize apply, only readiness.
**Reversibility:** hard (the data model + engine contracts are the two spines everything conforms to); the migration apply itself is irreversible (staging + Founder-gated).
**Owner:** ceo (session `ceo-6`). **Affects:** CTO (Phase 5 per-feature specs → `docs/04-features/specs/`), database-engineer (apply after staging), backend-engineer (P3 Zod validator implements store-config incl. the theme union; call `get_public_profile()` for author display; the 4 P3 follow-ups), ai-engineer (build the pipeline + engine + shared eval harness), Design-Lead (owns store-config.schema.md v1.1). Full detail: `docs/03-system-design/adr/0001..0003` + the two spec files.

## 2026-07-19 — D16: 8 "final missing features" grilled & tiered (7 MVP, 1 roadmap)

**Context:** Founder supplied `KOL_Final_Missing_Features.docx` (8 features) and asked to "make sure we have those." CEO cross-checked vs the 31-feature tree, grilled each.
**Decision:** **MVP (7):** Two Shopping Modes (search/filters as utility — results open maker worlds, NEVER a flat grid; feed stays default); Proof of Product (maker-declared+shown provenance, not physical verification); Ask the Maker (public per-product Q&A text/audio/video); Exactly What to Expect (required structured product-info standard); Trustworthy Reviews (verified-purchase + photo/video + variation + maker responses); **Guided Buyer–Maker Co-Creation — FULL** (brief → buyer↔maker messaging → shared drafts → revisions → approve); Relationship-Based Ranking (follow/save + purchase/question/project signals). **Roadmap v1.1 (1):** Live Studio Sessions (heavy streaming infra, doesn't gate core).
**Scope impact:** two NEW subsystems enter MVP — a buyer↔maker **messaging + draft-versioning** system (full co-creation; Ask-the-Maker reuses it) and **search/browse**. MVP feature count ~31 → ~39.
**Reversibility:** hard (scope decision); reversible (individual tiers). **Owner:** ceo (`ceo-5`). **Affects:** CPO (integrate into feature tree §3/§4/§5 in Phase 5), database-engineer (new tables in Phase 4: threads/messages/commissions/questions/follows/saves/product_specs/product_provenance/review_media), CTO (plan re-tier). Detail: concept-lock D16 + feature-tree §1D addendum.

## 2026-07-19 — D15: seller-shop design FREEDOM (amends D4/D9 anti-slop model)

**Context:** Founder challenged the constrained 5-palette model: capping seller shops to a fixed palette set = the "flattening" the whole product exists to fight. Clarified the design-system references/tokens were scoped for KOL's OWN product, and seller shops should be "as customizable as possible."
**Decision:** Two surfaces, two rules. (a) **KOL's own product UI** (feed/nav/chrome/checkout/marketing) keeps the FIXED design system (5 palettes/4 pairings/motion presets). (b) **Seller shops get FULL brand freedom** — any colors/fonts/imagery; AI derives a *coherent custom design system per shop* from the seller's brand; the 5 palettes are **starting points, not a cap**. Anti-slop for shops shifts from "palette limitation (layer 1)" to **AI-generation coherence + auto-critic (contrast/AA/hierarchy/coherence, auto-regen) + maker approval (layers 2+3)**. Layer 1 for shops = block system + mandatory AA enforcement only.
**Rationale:** Freedom for the artist/seller/brand is core to the vision ("no flattening, utopian store"); the "never slop" bar is held by an excellent critic + human approval, not training wheels. Bet: strong AI models make generation-coherence + critic good enough.
**Trade-off (accepted):** the auto-critic becomes LOAD-BEARING (not a backstop); quality variance rises vs a 5-option cap. Phase 4 AI-pipeline spec must include a robust "brand input → coherent custom design system" derivation + automated contrast/coherence enforcement.
**Reversibility:** hard (reframes D4/D9). **Owner:** ceo (session `ceo-5`). **Affects:** Design-Lead, ai-engineer (pipeline + critic), CTO (Phase 4 specs), QA-Lead (contrast enforcement). Full text: `docs/01-foundation/KOL-v2-concept-lock.md` D15.

## 2026-07-19 — KOL v2 concept lock: 13 decisions for the production-grade MVP build

**Context:** Adam signaled the product had evolved past the Jul-16 pitch vision and asked the CEO to grill him to re-align the design tree before planning the first real MVP build. Full 11-fork grill completed.
**Decision:** Locked KOL v2 as a **desktop-first, video-native marketplace** (Next.js) with 13 decisions (D1–D13) — see [`docs/01-foundation/KOL-v2-concept-lock.md`](../../docs/01-foundation/KOL-v2-concept-lock.md). Headlines: **D2 auth is now IN scope** (Supabase, reversing the earlier "skip auth"); **D4** stores are a section/block library + per-maker JSON config (AI emits data, never code); **D5** one unified rules+context video engine (discovery + store + contextual narration, AI-ranker-ready); **D6** KOL-owned Stripe test-mode checkout; **D8** seller co-creation loop (interview → AI drafts JSON → maker co-edits → approve); **D9** 3-layer anti-slop (constrained primitives + auto-critic + human gate); **D12** 4 team-produced worlds (one per teammate, 3 pre-built + 1 live); **D13** competition = checkpoint on a production build, then cutover to real buyers+sellers.
**Rationale:** Hybrid scope (D3) proves the full experience end-to-end while bounding the hardest part (generation) to one flow; JSON-config store engine makes both hand-built and AI worlds share one renderer and keeps AI output structurally safe.
**Reversibility:** hard (D1/D2/D4/D5/D8/D9/D13); reversible (D3/D6/D7/D10/D11/D12)
**Owner:** ceo (session `ceo-5`)
**Affects:** ALL — CTO/CPO/CMO/Design-Lead/Research-Lead/QA-Lead + every worker. Master build plan: [`docs/03-system-design/KOL-MVP-master-plan.md`](../../docs/03-system-design/KOL-MVP-master-plan.md). Supersedes the Jul-16 `KOL-vision-capture.md` where they conflict; the "In the Making / Proof-of-Batch" pitch bet is now historical framing, not the current build target.

## 2026-07-16 — Pitch finalized: named "KOL," tagline locked, rebalanced to full vision

**Context:** Finished the Day-4 concept pitch (from the 2026-07-15 spine entry below). Ran a 3-writer copy sprint (converged), a 6-writer/2-round fable tagline sprint, and a vision-alignment audit.
**Decisions:** (1) **Name = KOL** — Hebrew for *voice* (double meaning: the sound + being *heard*). Working name — **trademark/domain check still REQUIRED** before public/API use (see Etsyc entry). (2) **Tagline LOCKED: "Every maker, finally heard."** (3) **Vision rebalance:** founder flagged the deck over-indexed on the voice feature; captured the full vision in `docs/01-foundation/KOL-vision-capture.md` and rebalanced so the **personalized branded world (colors/film/studio), maker creative-authorship, and CONNECTION** land alongside trust — voice kept as the un-fakeable anchor + name, not the whole product. Founder confirmed aligned.
**Deliverable (FINAL, paste-ready):** `docs/05-marketing/HLV-pitch-KOL-slidebuild.md` (v3).
**Reversibility:** reversible (pre-pitch copy) except the name (trademark = do NOT go public before clearing).
**Owner:** ceo (session ceo-hlv-pitch) · **Affects:** cmo (copy), cpo/design-lead (prototype: transcript-grounded personalized store + "tap→hear"), legal (KOL trademark check).

## 2026-07-15 — Pitch spine evolved: founder re-opened "In the Making," landed on "Meet the maker before you meet the product" (voice-cited discovery)

**Context:** Founder-led interview + brainstorm + 6-persona board (R0/R1 in `docs/08-agents_work/2026-07-15-pitch-board/`) to lock the Day-4 (Jul 16) HLV×Etsy **concept pitch** (3 min, ISS words-only template, spoken live; job = recruit a team + land with Etsy mentors).
**Decision (pitch spine):** A **new way to shop built around the real human behind the product, not a grid.** Discovery-first (connection *before* purchase; watch-it-made = post-purchase encore). Feed = the **making** (hands/material/time) with the **maker's own voice** as the soundtrack; tap in → her voice keeps playing beside a store that feels like her.
**The board reframe (adopted, load-bearing):** the un-fakeable atom is **the maker's own voice + hands, cited to timecode** — *"tap any line, hear the exact second she said it."* Replaces the earlier, indefensible *"AI bounded by design"* trust claim (which all 6 personas said a mentor guts in one question, and which IS the platform-declared trust Q4 pre-rejects). **AI is demoted from the trust story to invisible plumbing** — it does the design work the maker can't, but never speaks for her.
**Other locked calls:** price → lead with *"support," "even pay a little more"* as honest tail, no number (mentors bite unproven premiums). Vision → **stay grounded** ("a new way to shop from real humans"), not moonshot. Positioning → own app / Etsy-compatible add-on. Voice/delivery → file 06 (plain, human) + file 07 (open the door, let them discover it). Cut AI-store-builder airtime to one line; plant team-shaped lanes.
**Supersedes:** the 2026-07-15 "In the Making / Proof-of-Batch" locked bet (post-purchase, anti-story) — founder deliberately re-opened it; discovery-first story/connection now leads, with proof-of-making folded in as the trust atom.
**Still to nail in the draft:** the on-stage answer to "sellers won't do this" (one concrete maker + one low-effort ritual); the team lanes.
**Reversibility:** hard-to-reverse (whole deck orients here) · **Owner:** ceo (session ceo-hlv-pitch) · **Affects:** cmo (deck copy), cpo/design-lead (prototype: transcript-grounded store + "tap→hear"), research (seller-consent + say-do gates).
**Board verdict:** 4 PROCEED_WITH_CONDITIONS + 2 RECONSIDER, zero KILL. Full digest: `docs/08-agents_work/2026-07-15-pitch-board/R1-digest.md`.

## 2026-07-15 — Interview corpus (7 recordings) independently corroborates the locked "In the Making" bet

**Context:** Transcribed files 06–07 and produced `FINAL-SUMMARY.md` across all 7 recordings, then cross-checked it against the already-locked "In the Making" / Proof-of-Batch bet (entries below) — which the parallel `ceo-realness` workstream locked earlier today off the same `SYNTHESIS.md`.
**Finding:** The interview evidence supports the locked reframe with no contradiction. Say/do gap, "authenticity = not a scam," seller apathy (*"almost no interaction at all with the customer"*), and price-defection all argue **against** a relationship product and **for** a low-seller-effort, buyer-visible proof-of-human. This is exactly the bet.
**One tension logged (not a reversal):** the interviews show the **seller** as the higher-pain, lower-alternative user (05/06), which naively reads as "build seller-side tooling." The board already adjudicated this via the Dina-Murphy-portfolio constraint — build the **buyer-side** In-the-Making experience and keep seller effort near-zero. The interviews reinforce *why* seller effort must be near-zero (apathy is real and fatal to seller-chore products), not that we should flip the wedge seller-side. No change to D1–D9.
**New material:** file 06 = a founder product-thesis monologue (leans seller-tooling — a pre-board framing) usable as pitch problem-articulation; file 07 = pitch-delivery craft. Neither is buyer-demand evidence.
**Reversibility:** reversible (evidence/documentation log).
**Owner:** ceo (session `ceo-columbia-5-6-transcripts`)
**Affects:** cmo (may quote interview lines in the deck), cpo (crux framing), research-lead (the gate interviews in `docs/00-inbox/ACTIONS-2026-07-15-interviews.md`). Full reasoning: `docs/research/interviews/FINAL-SUMMARY.md`.

## 2026-07-15 — Board verdict: PROCEED_WITH_CONDITIONS on "In the Making" (6-persona board, R0→R3)

**Context:** Stress-tested the locked pitch bet via full board-meeting protocol before committing the 7 remaining build days. 6 personas, R1 independent → R2 cross-critique → R3 fresh-context synthesis.
**Verdict:** PROCEED_WITH_CONDITIONS. R1: 5 PROCEED_WITH_CONDITIONS + 1 PAUSE (broad-adversary). R2: broad-adversary moved to PWC → unanimous. R3 locked 9 decisions.
**Locked (R3):** (D1) Pitch architecture — slide 1 names the PRIMITIVE "Identity-Bound Commerce / Human Provenance Network"; In-the-Making = felt/demo expression + Trust-Graph = durable/roadmap expression on same slide; open on Dina Murphy coherence-gap + −11% habitual-buyer wound. (D2) Build In-the-Making + Proof-of-Batch ONLY; never build Trust-Graph (>60% cold-start miss). (D3) Retire "Made Just After You Ordered" → **Proof-of-Batch** ("yours is #7 of 12"). (D4) Zero-hands QR-sticker + shelf-phone (iOS Guided Access) rig. (D5) HMAC "Verified capture" badge now, C2PA roadmap-only; reframe "unfakeable video" → "identity-bound named-seller accountability." (D6) Two complementary gates. (D7 IRREVERSIBLE) Adam pre-commits pivot triggers IN WRITING Day 3. (D8) Hands-only + face-blur + preview-approve privacy. (D9) Honest return loop ~1.4–2.2× not 3×.
**Preserved dissent (broad-adversary):** Trust-Graph is the true durable spine; In-the-Making frequency is order-count-ceilinged; vindicated if Day-4 probe <60% OR capture <60% OR no Sora-decay answer without C2PA.
**Reversibility:** hard (D1/D2), irreversible (D7 pivot pre-commit)
**Owner:** ceo-realness
**Affects:** cpo/design-lead (build In-the-Making + Proof-of-Batch), research (Day-4/5 gates), cmo (deck: primitive-first), Founder (D7 written pre-commit)
**Sources:** docs/08-agents_work/2026-07-15-realness-board/ (R0-framing, R1-digest, R2-digest, R3-synthesis + 12 per-persona files)

## 2026-07-15 — Goal locked: "In the Making" (Made Just After You Ordered)

**Context:** After 4-thread research + divergent brainstorm across sides/pains, needed a single pitch spine for the 2-week HLV build.
**Options considered:** Follow-the-Hands (feed / biggest frequency swing, hard to demo) / Made-Just-After (make-my-thing progress loop, most demoable + deepest proof) / Trust-Graph (most defensible + on-brief Q4, worst cold-start).
**Decision:** Crown **"In the Making"** (Made Just After) as spine/hero; Follow-the-Hands + Trust-Graph become "the system it scales into." Passive process clip is the shared atom.
**Rationale:** Best proof×frequency×demoability for a 2-week prototype; resolves the core logic gap (proof is one-time, frequency needs recurrence) with one asset.
**Reversibility:** hard-to-reverse (whole pitch now orients here; revisit only if crux tests fail)
**Owner:** ceo-realness
**Affects:** cpo/design-lead (prototype), research (crux validation), cmo (pitch narrative)
**Crux to validate (days 5-9):** seller-effort-at-scale · buyer return-pull · proof legibility & fake-resistance. Full goal: docs/01-foundation/realness-goal.md

## 2026-07-15 — Realness Question: contrarian "unfakeable proof-of-human" reframe

**Context:** HLV × Etsy challenge (Columbia, Jul 13-24). Brief poses the romantic framing: Gen Z craves realness, AI killed proof, so build ways to find/believe/connect with makers. Our own discovery synthesis (5 interviews) contradicts the romantic version.
**Options considered:** A) Romantic framing — build maker-connection/storytelling features (what every other team will pitch). B) Contrarian framing — old signals dead + connection features die on seller apathy + price beats virtue, so build a NEW unfakeable trust signal at point-of-discovery requiring ~zero seller labor. C) Pure anti-fraud/verification play.
**Decision:** Pursue B as the working thesis, grounded in three findings: stated≫revealed preference, connection absent-by-design on Etsy, "authenticity"="not a scam."
**Rationale:** It's the only lane the data supports AND that differentiates from the obvious pitches. Reframe = "unfakeable, discovery-time, zero-seller-effort proof-of-human."
**Reversibility:** reversible (working thesis, pre-brainstorm)
**Owner:** ceo-realness
**Affects:** research-lead, cpo, design-lead, cmo — all downstream brainstorm/pitch work
**Research dispatched:** 4 parallel researchers → docs/research/realness/ (01 unfakeable-signals, 02 stated-vs-revealed, 03 genz-trust-behavior, 04 etsy-business-context). Grill + brainstorm to follow synthesis.

## 2026-07-14 — The name "Etsyc" must be abandoned (AWAITING FOUNDER SIGN-OFF)

**Context:** Before running seller outreach, the CEO commissioned a trademark check on "Etsyc" /
etsyc.com. The outreach plan would have put the name on a sending domain, a survey form, and
hundreds of emails to Etsy sellers.

**Findings (all sourced, HIGH confidence):**
- Etsy's Trademark Policy prohibits exactly this construction, verbatim: *"DON'T use the Etsy Marks
  or a term confusingly similar to 'Etsy' in the name of your company, organization, domain name,
  or trademark"* and *"DON'T alter, distort, or modify the Etsy Marks, including adding other terms
  to the Etsy Marks to create new words."*
- ETSY is a registered USPTO word mark (Reg. 3,297,913, registered 2007, renewed).
- WIPO **D2025-1536** (2025): `etsyuniverse.com` held confusingly similar for wholly adopting the
  mark plus a common term — **transferred to Etsy**. Near-on-point for `etsyc.com`.
- The 2008 case that Etsy *lost* (`etsey.com`, NAF FA0810001222645) turned solely on the domain
  predating Etsy's trademark rights. That defence is unavailable now.
- **The real kill switch is not litigation — it is the API.** Etsy's API Terms require app names to
  comply with the Trademark Policy; developers are documented as having API keys rejected for
  including "etsy" in the app name, silently and with no appeal. Etsyc's product depends on that API.
- Nominative fair use does NOT protect a mark inside your own brand name (New Kids 3-part test,
  prong 2 and 3). It DOES protect *"a tool for Etsy sellers"* as a descriptive tagline.
- **eRank was originally "EtsyRank"** and rebranded. No major incumbent (EverBee, Alura, Marmalead,
  Sale Samurai, Vela) uses "Etsy" in its brand. This is not a coincidence.

**Decision:** Rebrand before applying for an Etsy API key or publishing anything under the name. Do
not stand up etsyc.com even as a placeholder — public use with knowledge of the mark is evidence of
bad faith in a UDRP. Keep "for Etsy sellers" as a tagline; that is safe and is how every incumbent
operates.

**Rationale:** Cheap to fix today (a naming session). Existential later, once there are customers,
an API key, and search equity in the name. The API-rejection path means the product can die without
anyone ever sending a legal letter.

**Reversibility:** irreversible (once public use begins, it becomes UDRP evidence)
**Owner:** ceo
**Affects:** all — domain, product name, outreach sending domain, survey branding, API application
**Status:** Recommendation. Awaiting Adam's sign-off.

---

## 2026-07-22 — A convention recorded in prose is not a convention; declare shared contracts once, in code

**Context:** Wave-3 T1. Five units independently invented five cookie conventions. I recorded the
canonical names in DECISIONS.md, verified every unit imported them, and considered it closed. B5 then
imported the canonical *names* while reimplementing the *behaviour* — dropping `secure` off an HMAC
cookie. I amended the convention to say attributes are part of the contract, recorded that too, and
again moved on.

An integration dry run later found the amendment had not held: **ring-cookie write attributes were
still declared four independent times** (`feed/select.ts:263`, `grow/actions.ts:56`,
`browse/select-browse-clip.ts:34`, `narration/actions.ts:48`). Attribute-identical by luck, not by
construction. Worse, browse's module-level const froze `NODE_ENV` at import — precisely the bug
narration's own fix comment forbids. Diverging attributes make browsers fork the cookie by scope,
silently splitting buyer identity.

**Decision:** A cross-unit contract is only enforced when a single declaration is *imported* and the
compiler fails on divergence. Writing the rule in DECISIONS.md, and verifying compliance by review,
does not survive the next unit. Shared attribute sets ship as an exported **function** (not a const —
consts freeze environment reads at import) with a test asserting every call site via `toEqual`.
`toMatchObject` is banned for this class: a partial matcher is how the stripped `secure` passed review.

**Rationale:** This is instance six or seven of the same failure in one wave (also: `405` hard-coded
for `resolveEdgeMs("ungrow")`, `CHROME_LEAVE_MS` duplicating `--dur-state`, test rigs re-typing
`FRAME_MEDIA_SELECTOR`). The pattern is unmistakable: **every constant that two units must agree on
will diverge unless the second unit physically cannot re-declare it.** Detection by review scales
with reviewer diligence; detection by compiler does not need to.

The correction to my own practice: when a gate finding is a *pattern* rather than a one-off, the fix
is not a rule — it is removing the ability to break it, plus a sweep of the existing instances. Note
`live-composition.test.ts` had the collection fix months earlier tagged `F12 (QA-Lead gate-1 must-fix
5)`; it was fixed in one file and never swept, so six siblings shipped broken. Same lesson.

**The oracle rule (added after implementation):** when centralizing a constant, the *call sites* must
import it, but the *tests* must keep independently re-typed expected values. If every writer's test
asserted against the shared declaration, a canon-wide drift would pass all of them at once. As the
implementing engineer put it: **"re-typed expectations are the oracle; re-typed source was the defect."**

**Corollary — test workarounds can mask the bug they appear to cover.** Browse's suite carried a
`vi.resetModules` + fresh-import dance that existed solely to work around the frozen `NODE_ENV`. It
codified the freeze rather than failing it, and would have passed the re-freeze mutation. Removing
the workaround is what made the assertion load-bearing. Treat any test scaffolding that exists to
accommodate a known wart as a suspect, not as neutral.

**Reversibility:** reversible
**Owner:** ceo
**Affects:** cto, all workers — cookie writes, design tokens, shared selectors, any cross-unit constant
**Status:** Adopted and implemented on `integ/wave3-dryrun` (`ringCookieOptions()` exported once, four
writers import, three mutations verified red). Seventh instance — the `kol_sid` mint in
`lib/supabase/middleware.ts` — sanctioned for the same treatment via `lib/feed/session.ts`.

---

## 2026-07-22 — Commit before you mutate; and a fix that widens a range re-opens bounds the old code was accidentally immune to

**Context:** Mutation verification became the standard this wave — break the guard, watch the test go red, restore, report. It was used ~15 times and caught real defects every time (a fake test certifying a broken gate, five surviving mutants in one controller, an unwired seam that left 62 tests green). Two operational lessons came out of running it that often.

**1. Mutate only committed code.** An engineer reverted a mutation with `git checkout <file>` while feature work in the same file was still uncommitted — and lost the feature work with the mutation. It failed loudly at test collection and was re-done, but silence was equally possible. **Commit the work first, then mutate, then `git checkout` freely.** The technique's whole value is that the revert is trivial; that only holds if the revert can't take anything else with it.

**2. A correctness fix that widens an input range re-opens bounds the old code was accidentally immune to.** Fixing per-product currency to carry ISO-4217 exponents added three-decimal currencies — and a 7-digit three-decimal amount (9,999,999.999 KWD = 9,999,999,999 minor units) overflows `int4`. That hole did not exist before **only** because every price was hardwired to two decimal places. The old constraint was load-bearing without anyone declaring it.

**Decision:** When a change widens a domain (more currencies, more locales, more content lengths, more viewports), explicitly re-derive the bounds that the narrower domain was silently satisfying. Ask what the old restriction was accidentally protecting. Related: when deleting a now-unsafe helper, **delete it rather than deprecate it** — the currency fix removed the 2dp-only `priceMajorSchema` export outright, on the reasoning that leaving it importable invites exactly the misuse being fixed. A deprecated export is a re-declared constant with a comment on it.

**Reversibility:** reversible
**Owner:** ceo
**Affects:** all workers — mutation testing procedure; any change that widens an input domain
**Status:** Adopted.

---

## 2026-07-22 — Production data was repaired in-place; clipboard is banned as an SQL transport

**Context:** The seed for the live Supabase project (`zmlkduvvlzfgoqzjxzzl`, Shaian's own — see memory) was originally applied by pasting `pbcopy`'d SQL into the dashboard SQL editor. The clipboard transit MacRoman-mojibaked every multi-byte character (— – × · á § → °) across `profiles`, `stores` (incl. `config` jsonb), `products`, and `product_specs` — user-visible as "Tom√°s Ferreira" on the landing page.

**Decision:** Repaired IN-PLACE via the authorized Supabase MCP (`execute_sql`) with a pg_temp reverse-`replace()` over all seeded text columns; verified zero corrupt rows after. The seed FILES were always correct — no repo change. All future SQL against the live DB goes through the Supabase MCP or psql, never a clipboard paste.

**Reversibility:** irreversible (data mutation outside migrations, no backup taken — acceptable: seed files remain ground truth and are idempotent upserts)
**Owner:** solo session (deployment handoff)
**Affects:** anyone applying SQL to the live project; anyone diffing DB content against seed files
**Status:** Adopted.
