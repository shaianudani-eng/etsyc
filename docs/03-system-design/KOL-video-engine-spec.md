# KOL — Video Engine Spec (the D5 Spine)

*Phase 4 deliverable · session `ai-engineer-kol-video-engine` · 2026-07-19. The build contract for **P6 (unified video-selection engine)** and **P7 (video-profile tagging pipeline)**. Implements D5; folds in D16-7 (relationship-based ranking). Decision record: [`adr/0003-video-engine.md`](./adr/0003-video-engine.md).*

> **What this is.** The one engine that decides *which real footage plays, when*. It serves the discovery feed (B1), the persistent in-store player (B3/B4), and contextual product narration (B5) from a single pipeline: **eligibility filter → scoring → anti-repetition**. It selects; it never generates (D5). It reads the canonical `videos` / `video_profiles` / `buyer_signals` tables — **never `blocks` or per-store config**.
>
> **What this is NOT.** Not the store renderer (P4, that's D4). Not a buyer-time generator. Not a general-popularity recommender — relationship ranking is per-buyer affinity, not global counts.

---

## 0 · The locked data contract (cite-as-is — do NOT redesign)

The engine is a **reader** of tables owned by Workstream A (ADR-0001, migration group `03_media_videos.sql` + `12_relationship.sql`). Reproduced verbatim for reference — this spec adds no columns.

### 0.1 `videos` — canonical clips (OQ-2)
```sql
create table public.videos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  store_id     uuid references public.stores (id) on delete cascade,
  src          text not null,
  poster       text,
  duration_ms  integer,
  captions_src text,
  created_at   timestamptz not null default now()
);
```

### 0.2 `video_profiles` — the ONLY signals the engine selects on (1:1 with videos)
```sql
create table public.video_profiles (
  id                  uuid primary key default gen_random_uuid(),
  video_id            uuid not null unique references public.videos (id) on delete cascade,
  purpose             text[] not null default '{}',   -- intro|craft-story|process|product-narration|thankyou|atmosphere
  page_eligibility    text[] not null default '{}',   -- feed|grown|world|product|checkout|thankyou
  product_links       uuid[] not null default '{}',   -- product ids (app-validated; no element FK)
  mood                text[] not null default '{}',   -- calm|warm|energetic|intimate
  anti_repetition_key text,
  created_at          timestamptz not null default now()
);
-- Array columns GIN-indexed: purpose, page_eligibility, product_links, mood.
-- anti_repetition_key: btree.
```

### 0.3 `buyer_signals` — the D16-7 relationship event log (engine reads via service role)
```sql
create table public.buyer_signals (
  id           uuid primary key default gen_random_uuid(),
  buyer_id     uuid not null references public.profiles (id) on delete cascade,
  subject_type public.signal_subject not null,  -- maker | store | product
  subject_id   uuid not null,                    -- polymorphic; app-validated
  signal_type  public.signal_type not null,      -- visit|purchase|question|save|follow|commission|review
  weight       numeric(6,3) not null default 1.0,
  created_at   timestamptz not null default now()
);
-- Composite index: (buyer_id, subject_type, subject_id, signal_type).
```

**Contract invariants the engine relies on (from ADR-0001):**
- `videos` + `video_profiles` are **source of truth**. `stores.config.media.clips[].id` MUST equal a `videos.id`; the config mirror is maintained app-side (write config → upsert `videos`/`video_profiles` in the same transaction). **The engine ignores the config mirror entirely** and queries the tables.
- `video_profiles.product_links` is `uuid[]` with **no element-level FK** — referential integrity to `products` is the Zod validator's job, not the DB's. The engine treats a dangling `product_links` id as "no narration match" and falls back (see §2, NARRATE_SHRINK).
- `buyer_signals` is **private under RLS** (buyer owns own rows). The engine reads it with the **Supabase service role** on the server — never from the browser. This is the trust boundary; see §5.4.

> **Naming note.** The store-config schema doc uses camelCase (`videoProfile.pageEligibility`); the canonical tables use snake_case (`video_profiles.page_eligibility`). They are the same fields. This spec uses the **snake_case table names** because the engine queries the tables. Any app-layer type maps camelCase config → snake_case rows at the sync boundary (not the engine's concern).

---

## 1 · Engine shape — the unified pipeline (D5)

ONE engine. Every buyer state calls the same function with a different `EngineContext`. The pipeline is fixed and ordered:

```
                 ┌───────────────────────────────────────────────────────────┐
  EngineContext  │  STAGE 1                STAGE 2              STAGE 3        │
  (state, buyer, │  Eligibility filter ──► Scoring ──────────► Anti-repetition│──► Selection
   store scope,  │  (SQL, GIN-served)      (Ranker seam)        (session dedupe)│    (1..N clips)
   product, mood)│  candidates ⊆ videos    ranked candidates    deduped result │
                 └───────────────────────────────────────────────────────────┘
```

### 1.1 The one entry point (conceptual signature — TS types, not built here)
```ts
type BuyerState =
  | 'FEED' | 'GROWN' | 'WORLD_OPEN' | 'WORLD_BROWSE'
  | 'NARRATE_SHRINK' | 'PRODUCT_PAGE' | 'CHECKOUT' | 'THANK_YOU';

interface EngineContext {
  state:        BuyerState;
  buyerId:      string | null;      // null = anonymous (cold-start)
  sessionId:    string;             // anti-repetition scope (see §3.1)
  storeScope:   string | null;      // null in FEED (cross-maker); a store_id once a world is open
  productId:    string | null;      // set for NARRATE_SHRINK / PRODUCT_PAGE
  moodHint:     Mood[] | null;      // optional per-state mood bias
  limit:        number;             // FEED wants many; narration wants 1
}

interface Candidate {
  videoId:  string;
  profile:  VideoProfile;           // the row from video_profiles
  storeId:  string | null;
  ownerId:  string;                 // maker — used for relationship signal
  features: ScoreFeatures;          // computed in stage 2 (see §4)
}

interface Selection { clips: SelectedClip[]; debug?: ScoreTrace[]; }

// The engine:
function selectVideos(ctx: EngineContext): Promise<Selection>;
```

The three stages are pure and composable: `antiRepetition(rank(eligible(ctx)))`. Stage 2 (`rank`) is the **Ranker seam** (§4.4) — swappable without touching stage 1 or 3 or any caller.

---

## 2 · State → query map (the eligibility stage)

Each buyer state (feature-tree §4) is exactly one eligibility query. The query is a **set-intersection over the GIN-indexed arrays** of `video_profiles`, joined to `videos` for scope. Below, `&&` is the Postgres array-overlap operator (index-served by GIN); `@>` is array-contains.

> **Reading the table:** "`page_eligibility` ⊇ {x}" means the clip is eligible for page x. Where a state names a `purpose` set, the clip must overlap it. `storeScope`/`productId` narrow via `videos.store_id` / `product_links`.

| State | `page_eligibility` must contain | `purpose` overlap (`&&`) | Store scope | `product_links` | `mood` | `limit` |
|-------|-------------------------------|--------------------------|-------------|-----------------|--------|---------|
| **FEED** | `feed` | `{intro, craft-story, atmosphere}` | **cross-maker** (`store_id` unrestricted; one per store — see §2.1) | — | optional bias | many (e.g. 12–24) |
| **GROWN** | `grown` | `{intro, craft-story}` | the tapped clip's `store_id` | — | inherit feed clip | 1 (the grown clip) + peers |
| **WORLD_OPEN** | `world` | `{intro, craft-story, atmosphere}` | `= storeScope` | — | store brand mood | 1 (persistent player) |
| **WORLD_BROWSE** | `world` | `{process, atmosphere, craft-story}` | `= storeScope` | — | store brand mood | 1..few (swap on scroll) |
| **NARRATE_SHRINK** | `product` | `{product-narration}` | `= storeScope` | `@> {productId}` | `intimate` bias | 1 |
| **PRODUCT_PAGE** | `product` | `{product-narration, process}` | `= storeScope` | `@> {productId}` (fallback: any product-narration in store) | `intimate` bias | 1 |
| **CHECKOUT** | `checkout` | `{atmosphere}` (or none — often no clip) | `= storeScope` | — | `calm` | 0..1 |
| **THANK_YOU** | `thankyou` | `{thankyou}` | `= storeScope` | — | `warm` | 1 |

### 2.1 FEED query — structurally excludes `thankyou` (the LOCKED constraint)

The magazine feed (B1) mixes makers. The eligibility predicate is **positive** — a clip is only a feed candidate if `page_eligibility @> {'feed'}`. Because a `thankyou` clip is tagged `page_eligibility:['thankyou']` **only** (locked, store-config §2.3), it can never satisfy `@> {'feed'}`. Exclusion is therefore *structural*, not a blocklist — there is no code path that adds a thank-you clip to the feed.

```sql
-- FEED: cross-maker eligible pool, one clip per store for magazine variety.
-- Runs with anon or service role; RLS 'video_profiles_public_read_published'
-- already limits rows to PUBLISHED stores (ADR-0001 group 03).
select distinct on (v.store_id)
       v.id            as video_id,
       v.store_id,
       v.owner_id,
       vp.purpose, vp.page_eligibility, vp.product_links, vp.mood,
       vp.anti_repetition_key,
       v.duration_ms, v.poster, v.src, v.created_at
from   public.video_profiles vp
join   public.videos v on v.id = vp.video_id
where  vp.page_eligibility @> array['feed']              -- POSITIVE predicate → thankyou can't appear
  and  vp.purpose && array['intro','craft-story','atmosphere']
  -- optional mood bias applied in scoring, not filtered here (keep pool wide)
order  by v.store_id, v.created_at desc;                 -- 1 candidate/store; scoring reorders across stores
```

**Why `distinct on (store_id)`:** the feed is a magazine of *makers*, not clips — one hero candidate per store enters scoring; scoring + anti-repetition then order and dedupe across makers. (Tap → GROWN can pull that store's peers.)

> **Confirmed (P3-1) — `order by … created_at desc` picks each store's NEWEST eligible clip as its feed candidate.** This is **intended**: the feed advertises a store with one fresh hero, and a maker's latest footage is the intended "front of shop." The trade-off is real and accepted — a store's *better-but-older* eligible clip is dropped **before** scoring (per-store cut is a pre-scoring `distinct on`, so cross-store scoring never sees it). Rationale: (a) freshness is a deliberate feed value (the `Freshness` term + "reshuffles per visit"); (b) the tie-break must be deterministic for the seeded-shuffle/test story (§3.3) — `created_at desc` is stable; (c) a maker with a strong older clip should re-tag/re-record or promote it (manual `anti_repetition_key`/tags, §6.1). **If quality-over-freshness is wanted later:** change the `distinct on` tie-break to pick the store's top clip by a lightweight pre-score (e.g. `Business` term) instead of `created_at` — a one-line `order by` swap, no pipeline change. Flagged as tunable (relates to OQ-V3 weights), not blocking.

**Structural test (must exist in the suite):** insert a store with one `feed` clip and one `thankyou` clip; assert the FEED selection contains the feed clip and **never** the thankyou clip, for any buyer/seed. This is the load-bearing invariant of the whole engine.

### 2.2 NARRATE_SHRINK / PRODUCT_PAGE — product-scoped narration

```sql
-- NARRATE_SHRINK: the right clip for the product now on screen.
select v.id as video_id, v.store_id, v.owner_id, vp.*
from   public.video_profiles vp
join   public.videos v on v.id = vp.video_id
where  vp.page_eligibility @> array['product']
  and  vp.purpose          @> array['product-narration']
  and  v.store_id = $storeScope
  and  vp.product_links    @> array[$productId::uuid]     -- clip tied to THIS product
order  by v.created_at desc
limit  1;
-- Fallback if empty: drop the product_links predicate → any product-narration clip
-- in the store; if still empty → keep the persistent world clip playing (no shrink narration).
```

`product_links` has no DB FK (§0.3); a stale id simply yields zero rows and the fallback runs. The engine never errors on a dangling product link.

### 2.3 WORLD_OPEN vs WORLD_BROWSE — the persistent player

`WORLD_OPEN` picks the store's signature clip (the video the world unfolds around — usually the same `intro` clip promoted from the feed, so the transition is seamless: the feed clip *grows* and stays). `WORLD_BROWSE` may **swap** to `process`/`atmosphere` clips as the buyer scrolls, subject to anti-repetition (§3) so the same clip doesn't loop. The persistent player is a single-clip slot; swaps are scoring-driven, not random.

---

## 3 · Scoring + anti-repetition

### 3.1 Session + anti-repetition (stage 3)

- **Session window:** a `sessionId` (opaque, per browser tab/visit; feature-tree "reshuffles per visit"). Recommended TTL **30 minutes** of inactivity, hard cap **2 hours**. On expiry the anti-repetition memory resets (a returning buyer may see a clip again — accepted, §ADR trade-off).
- **Dedupe key:** `video_profiles.anti_repetition_key` (NOT `video_id`). Sellers tag near-duplicate takes with the same key so the engine treats "three angles of the same wheel-throwing shot" as one thing. If `anti_repetition_key` is null, fall back to `video_id`.
- **Dedupe rule:** maintain a per-session set `seenKeys`. In stage 3, drop any candidate whose key ∈ `seenKeys`; after selection, add the chosen clips' keys to `seenKeys`. For the FEED (many clips at once), dedupe **within** the batch too (no two feed cards share a key).
- **Exhaustion encore (in-session reset — added 2026-07-22, P6b).** The rules above address *session expiry* (TTL/hard cap); they do not address a session that consumes the whole eligible pool before expiring. With a small published catalogue (launch: 4 makers → the FEED's `distinct on (store_id)` yields ~4 candidates) an engaged visitor exhausts the pool in minutes, and every later selection this session returns empty — the feed serves "You're all caught up" while eligible footage exists, and the persistent-player states (WORLD_BROWSE, NARRATE_SHRINK) freeze on their current clip. **Rule:** when stage 3's post-ring selection is empty AND the ranked-eligible input is non-empty AND `limit > 0`, re-run the selection against an **empty ring** — one encore pass, guaranteed non-empty — and write back **the encore batch's keys alone**, not those keys appended to the saturated ring. The write-back is therefore a **ring reset**: the visitor begins a fresh lap in ranked order and normal suppression resumes within that lap. (Appending instead would leave the ring saturated forever, so every subsequent call would re-encore and re-serve the ranked-first clip on repeat — worse than the empty it replaced.)
  - **Scope — this is a reset, not a weakening.** The encore fires **only** on total exhaustion; a partial selection stays partial (one surviving candidate is served alone, no top-up). It is the same trade-off the TTL reset already makes ("a returning buyer may see a clip again"), taken on pool exhaustion instead of on the clock. It changes nothing upstream: the encore re-runs over the **same ranked-eligible input**, so eligibility still decides correctness — a `thankyou` clip cannot ride the fresh lap into the FEED, and an empty *eligible* pool still yields an empty Selection (the encore never invents candidates; the "graceful empty, never throws" contract holds for the case it was actually written for).
  - **Why in the engine, not per caller.** Four callers consume selections (feed, grow, browse, narration) and each would need its own exhaustion detection and re-query, re-creating exactly the triplicated-invariant problem ADR-0003 exists to prevent. The condition is a property of stage 3's own state, so stage 3 owns it.
  - **Cost of the alternative.** Leaving exhaustion to callers means the empty state must read as intentional — defensible for a large catalogue, false advertising at launch scale, where "all caught up" after four clips reads as an empty marketplace rather than a finished one. Revisit if cross-session "don't re-show" ever lands (OQ-V4): a persistent seen-set makes exhaustion permanent rather than per-session, and the encore would then need an explicit "start over" affordance instead of firing silently.
  - **⚠ IMPLEMENTATION STATUS (2026-07-23) — SPECIFIED, NOT LIVE.** This rule is **not implemented in the current `apps/kol`**. It was built and QA-passed against the pre-rebuild engine, which the 2026-07-22 v1 archive moved to `.archive/kol-v1-2026-07-22/src/lib/engine/`; the v2 rebuild is screens-first on mock data and has no selection engine yet. **The working implementation is preserved on branch `claude/blissful-sutherland-c2b515`** (commits `e25746f`..`99c4af5`, pushed to the `fork` remote), carrying: the stage-3 change in `anti-repetition.ts`, the composition-root contract note in `select-videos.ts`, and eight tests across `anti-repetition.test.ts` + `select-videos.structural.test.ts` — including the re-pinned `visit3` lap, a two-lap cycle under a non-passthrough ranker, and the exhausted-ring-plus-non-persisting-cookie case. Verdict: QA-Lead **PASS** at `risk:full`, no P0/P1, all three P3 notes closed; four mutants killed (encore disabled, append-instead-of-reset, and both guard drops). **Whoever rebuilds stage 3 in v2: port that branch rather than re-deriving this rule** — the reset-vs-append distinction and the empty-*eligible*-pool carve-out are the two things a fresh implementation gets wrong. Do NOT git-merge that branch into main: its paths now resolve into `.archive/`, so rename detection files the fix silently into archived code (this was attempted and reverted on 2026-07-23).
- **Storage:** session-scoped, ephemeral. **Not** a new table — no schema change (the engine adds no columns, §0). Cross-session persistence is explicitly out of scope for MVP.
  - **Scale-safe default (confirmed P3-2): the signed-cookie key ring is the canonical store**, precisely because Vercel/serverless runs the engine across **many stateless instances** — a per-instance in-memory `seenKeys` set would NOT be shared between requests hitting different lambdas, so a buyer could re-see clips as they bounce across instances. The cookie carries the ring *with the buyer*, so anti-repetition holds regardless of which instance serves the next request. The ring is bounded to the last **N=50** keys (newest-wins eviction) to stay under cookie-size limits; the engine reads it in on request and writes the updated ring back in the response. In-memory is only an optimisation for a single long-lived process (e.g. local dev / a single container) — never the source of truth in the serverless deployment. (A shared cache like Redis would also work but is deliberately avoided for MVP — no new infra.)

### 3.2 Rules scoring formula (stage 2, default `RulesRanker`)

Score is a weighted sum of four term groups, each normalised to `[0,1]` before weighting. Higher = surface sooner.

```
score(clip, ctx) =
    w_business  · Business(clip, ctx)         // brand/business profile fit
  + w_situation · Situation(clip, ctx)        // buyer's current state/mood fit
  + w_freshness · Freshness(clip, ctx)        // recency + under-shown boost
  + w_relation  · Relationship(clip, ctx)     // D16-7 per-buyer affinity (§5)
```

**Term definitions:**

| Term | What it measures | Computed from | Range |
|------|------------------|---------------|-------|
| `Business` | Does this clip fit the store's brand/business profile and the state's purpose intent? | `purpose` overlap with state's preferred purposes (weighted: exact intent match = 1.0, adjacent = 0.5); store completeness (has verified trust badge, published) as a small multiplier | 0–1 |
| `Situation` | Does the clip's `mood` match the buyer's current state/mood hint? | Jaccard overlap of `clip.mood` ∩ `ctx.moodHint` (or state-default mood, §2 table); `duration_ms` fit for the slot (feed favours short punchy; world tolerates longer) | 0–1 |
| `Freshness` | Avoid staleness; give under-exposed footage a chance | `1 - normalized_age(created_at)` blended with an **under-shown boost** (inverse of how often this `anti_repetition_key` has been shown this session) + a small deterministic jitter seeded by `sessionId` (feed "reshuffles per visit") | 0–1 |
| `Relationship` | Per-buyer affinity to this maker/store/product (NOT global popularity) | Aggregated `buyer_signals` for `ctx.buyerId` toward this clip's `owner_id`/`store_id`/linked product — see §5 | 0–1 |

**Default weights (launch config — tune later, §4.2):**

| State | `w_business` | `w_situation` | `w_freshness` | `w_relation` |
|-------|-----------:|-----------:|-----------:|-----------:|
| FEED | 0.30 | 0.15 | 0.25 | **0.30** |
| GROWN / WORLD_* | 0.45 | 0.30 | 0.15 | 0.10 |
| NARRATE_SHRINK / PRODUCT_PAGE | 0.60 | 0.30 | 0.10 | 0.00* |
| CHECKOUT / THANK_YOU | 0.70 | 0.30 | 0.00 | 0.00 |

\* Narration is about *product fit*, not buyer affinity — relationship is deliberately zero so the correct product clip always wins. THANK_YOU is deterministic (the maker's one thank-you clip) — weights barely matter but keep business-dominant.

> Weights are **configuration, not architecture** (ADR consequence). They live in a single `SCORING_WEIGHTS` const keyed by `BuyerState`, are logged in the score trace, and are the first thing tuned against real interaction data. Flagged as an open question (values TBD post-launch).

### 3.3 Determinism + the "reshuffle per visit" requirement

The feed must look fresh each visit (B1) yet be reproducible for testing. Resolve with a **seeded jitter**: the `Freshness` jitter term is `hash(sessionId, video_id) → [0, ε]` with small ε (e.g. 0.05). Same session → same order (testable, cache-friendly); new session → new seed → reshuffle. No `Math.random()` in the scorer.

---

## 4 · The AI-ranker upgrade slot (D5)

The whole point of the pipeline shape: **stage 2 is replaceable**. D5 requires the engine be "AI-ranker-ready" — this is the seam.

### 4.1 The `Ranker` interface (the seam)
```ts
interface Ranker {
  readonly name: string;                 // 'rules-v1' | 'embed-rerank-v1' | 'llm-rerank-v1'
  rank(candidates: Candidate[], ctx: EngineContext): Promise<Candidate[]>;  // returns re-ordered (may trim)
}
```

- **Input:** the eligible candidate set (stage-1 output) + the full `EngineContext`. The ranker **never** re-queries eligibility — it only reorders/trims what stage 1 already deemed eligible. This keeps the locked constraints (thankyou-only, etc.) enforced *before* any AI touches the set.
- **Output:** a re-ordered (optionally trimmed) `Candidate[]`. Stage 3 (anti-repetition) always runs *after*, so no ranker can defeat dedupe.
- **Default impl:** `RulesRanker` (§3.2). **Upgrade impls (later):** `EmbeddingReranker` (cosine similarity of clip-profile embeddings vs a buyer/context embedding) or `LlmReranker` (an LLM scores/orders candidates). Callers are unchanged — they call `selectVideos`, which composes `antiRepetition(ranker.rank(eligible(ctx)))`.

### 4.2 The eval hook (a re-ranker cannot go live without passing it)

Any non-default ranker must pass an **offline eval** on a golden dataset before it is wired into `selectVideos` in production:

- **Metric:** `ranking_ndcg@k` (normalised discounted cumulative gain at k) against human-labelled "best clip for this context" judgments, plus a **regression guard**: the candidate the `RulesRanker` would have ranked #1 must not drop below rank R (e.g. 5) unless the new ranker's nDCG beats rules by margin m. This prevents a slick-but-wrong re-ranker from burying obviously-correct clips.
- **Gate:** the ranker ships behind a flag; the eval runs in CI on the golden set; **meanScore ≥ threshold AND no adversarial-case regression** is required to flip the flag. Same harness as P7 tagging (§6).
- **Cost:** an LLM re-ranker logs cost per call (§6.3); the eval reports `eval_cost_usd`. If per-selection cost exceeds budget, it stays offline. Rules ranker cost = 0 (no LLM).

### 4.3 Why the seam is upstream of anti-repetition, downstream of eligibility

Eligibility encodes **correctness** (a thankyou clip must never be in the feed — non-negotiable, not a ranking preference). Anti-repetition encodes **session hygiene**. Ranking encodes **preference/quality** — the only thing that benefits from ML. Putting the AI strictly between them means the AI can make the feed *better* but can never make it *wrong* or *repetitive*.

---

## 5 · Relationship-based ranking (D16-7)

The `Relationship` scoring term. The mandate (concept-lock D16-7, DECISIONS.md): follows/saves/purchases/questions/commissions feed ranking as **relationship** signals — **NOT general popularity**.

### 5.1 Popularity vs relationship — the structural difference

- **Popularity (rejected):** `count(*)` of signals toward a subject across *all* buyers → globally-loved makers dominate every feed → flattening (the thing KOL exists to fight). We do **not** compute this.
- **Relationship (chosen):** signals **filtered to `ctx.buyerId`** toward *this clip's* maker/store/product. Affinity is *yours*, not the crowd's. A maker you follow ranks up **for you**; that same maker gets no ranking boost for a buyer who's never interacted. Cross-buyer aggregates are never read into the score.

```sql
-- Relationship affinity for ONE buyer toward ONE maker/store (service role; buyer_signals is RLS-private).
select signal_type, count(*) as n, coalesce(sum(weight),0) as w, max(created_at) as last_at
from   public.buyer_signals
where  buyer_id = $buyerId
  and  ((subject_type = 'maker' and subject_id = $ownerId)
     or (subject_type = 'store' and subject_id = $storeId)
     or (subject_type = 'product' and subject_id = any($linkedProductIds)))
group  by signal_type;
```

### 5.2 Signal → weight mapping

Intentional strength ranking — a purchase/commission (deep relationship) outweighs a visit (shallow). These multiply the raw `buyer_signals.weight` (which lets sellers/ops tune per-event).

| `signal_type` | Relationship weight | Rationale |
|---------------|--------------------:|-----------|
| `commission` | 5.0 | Co-created something together — deepest relationship |
| `purchase` | 4.0 | Put money on this maker — strong trust |
| `follow` | 3.0 | Explicit ongoing-interest declaration (B13) |
| `question` | 2.0 | Reached out / engaged the maker (Ask-the-Maker, B12) |
| `save` | 1.5 | Bookmarked — soft interest (B13) |
| `review` | 1.5 | Post-purchase engagement (often implies purchase already counted) |
| `visit` | 1.0 | Weakest — mere exposure; capped hard (§5.3) |

### 5.3 Aggregation — affinity without collapsing into popularity

```
rawAffinity(buyer, subject) = Σ_over_signals  signal_type_weight · buyer_signals.weight · recencyDecay(created_at)
Relationship(clip, ctx)     = squash( rawAffinity )      // → [0,1]
```

Three guards keep it relational and prevent a single behaviour from dominating:

1. **Per-buyer only.** The query is always `where buyer_id = ctx.buyerId`. No global counts, ever. Anonymous buyer (`buyerId = null`) → `Relationship = 0`, feed leans on business + freshness (cold-start, ADR trade-off).
2. **Recency decay.** `recencyDecay = exp(-age_days / τ)`, τ ≈ 30d. A maker you engaged last year shouldn't crowd out fresh discovery — keeps the feed from ossifying around old favourites.
3. **`visit` cap + diminishing returns.** `visit` contribution is capped (e.g. at 3 effective visits) and the whole `rawAffinity` is passed through a saturating `squash` (e.g. `x/(x+k)`). So relationship *biases* toward makers you care about but can never *monopolise* the feed — discovery of new makers is preserved. This is the explicit "bias without collapsing into a popularity ranker" guard from the brief.

### 5.4 Trust boundary

`buyer_signals` is RLS-private to the buyer (ADR-0001 group 12: "Engine reads via service role"). Therefore the `Relationship` term is computed **server-side only**, with the service-role client, inside `selectVideos`. It is never sent to or computed in the browser. A future `LlmReranker` that wants relationship context receives it as already-aggregated scalar features (§5.1 output), never raw signal rows — no PII leaves the server.

---

## 6 · Video-profile tagging pipeline (P7)

How footage acquires the `video_profiles` row the engine selects on. Writes `videos` + `video_profiles` (§0). **This spec owns writing `video_profiles`; Workstream B's pipeline is a reader/consumer of tags.**

### 6.1 Two tagging modes

| Mode | When | Who sets tags | Trust |
|------|------|---------------|-------|
| **Manual** | Team-produced 4 worlds (D12); any seller who wants precision | Seller/ops in the co-edit editor (S4) — checkboxes for `purpose`/`page_eligibility`/`mood`, product picker for `product_links`, free-text `anti_repetition_key` | Ground truth |
| **AI-assisted** | Draft-time; seller uploads footage during the AI interview/co-creation (S2/S3) | An LLM proposes tags from the clip's transcript/captions + context; **seller confirms/edits before publish** (never auto-applied silently — D-guardrail "AI *with* the maker") | Suggestion → human-confirmed |

Both modes write the same `video_profiles` shape. AI-assisted is a *draft* that the seller reviews — consistent with the anti-slop human gate (D9 layer 3).

### 6.2 AI-assisted tagging — the LLM feature

- **Model:** `claude-haiku-4-5` (per CLAUDE.md routing: classification/tagging is a simple, short, structured task — Haiku is the right tier; escalate to Sonnet only if accuracy eval fails).
- **Input:** clip `captions_src` (WebVTT transcript) + `duration_ms` + store/brand context (craft, product titles) + the maker's interview answers if available.
- **Output (structured, Zod-validated):**
```ts
interface TagSuggestion {
  purpose:            Purpose[];          // subset of the 6 enum values
  page_eligibility:   PageEligibility[];  // subset of the 6 enum values
  product_links:      string[];           // product ids matched by title/description reference
  mood:               Mood[];             // subset of the 4 enum values
  anti_repetition_key:string;             // proposed slug, e.g. "sena-wheel"
  confidence:         number;             // 0–1, per-field low-confidence → flag for seller
}
```
- **Structural guardrail baked into the prompt:** a clip whose transcript is a closing/thank-you message MUST be tagged `page_eligibility: ['thankyou']` and `purpose: ['thankyou']` ONLY — the prompt states the locked constraint so the model can't propose `feed` for a thank-you clip. (Belt-and-braces: the eligibility stage enforces it regardless.)
- **System prompt shape:** role ("you tag maker footage for a video marketplace"), the enum definitions, the thankyou-only constraint, few-shot examples (one intro, one process, one product-narration, one thankyou), and "output only valid JSON matching the schema; set low `confidence` when unsure rather than guessing."
- **Prompt caching:** the enum defs + few-shot block (stable, >1024 tokens) carries `cache_control: { type: 'ephemeral' }` — reused across every clip at ~10% input cost.

### 6.3 Mandatory: error handling + cost logging (every call)

```ts
try {
  const res = await anthropic.messages.create({ model: 'claude-haiku-4-5', /* … */ });
} catch (e: unknown) {
  const err = e as { status?: number; message?: string };
  if (err.status === 429) { /* rate limit → exp backoff, retry ≤ 3 */ }
  if (err.status === 529) { /* overloaded → fail gracefully, seller tags manually */ }
  throw new Error(`tagging LLM call failed: ${err.message}`);
}
// Cost log — one JSON line per call (shared cost-log schema, §6.4):
console.log(JSON.stringify({
  event: 'llm_call', feature: 'video-profile-tagging',
  model: res.model, input_tokens: res.usage.input_tokens,
  output_tokens: res.usage.output_tokens,
  cost_usd: costOf(res.model, res.usage), latency_ms, ts: new Date().toISOString(),
}));
```

Overload/rate-limit never blocks a seller: on failure the editor falls back to **manual** tagging (§6.1). The engine only ever reads *confirmed* tags, so a failed suggestion degrades to manual, never to bad data.

### 6.4 Eval — tagging accuracy (P7's `*.eval.ts`)

- **Dataset:** a **labelled clip set** — minimum **12 golden clips** (satisfies the ≥10 floor with margin), spanning: one per `purpose` value (6), a multi-purpose clip, a thankyou clip (the critical adversarial case), a clip with an ambiguous product reference, a no-transcript clip (empty captions → must degrade, not hallucinate), and a foreign-language/edge caption. Each labelled with the ground-truth `TagSuggestion`.
- **Metric — `tagging_accuracy`:** per-field set-F1 over the array fields (`purpose`, `page_eligibility`, `mood`, `product_links`), plus an **exact-match hard-gate on the thankyou constraint** (proposing `feed` on a thankyou clip = automatic fail regardless of F1). Report macro-F1 and the thankyou-gate pass/fail.
- **Threshold:** macro-F1 ≥ 0.80 to ship the AI-assist as a *default suggestion*; thankyou-gate must be 100%. Below threshold → AI-assist stays off, manual only, escalate model to Sonnet and re-eval.
- **Cost:** eval sums `cost_usd` → `eval_cost_usd`; a Haiku tagging pass over 12 short clips is well under a cent — reported, not just assumed.

---

## 7 · Shared eval harness — AGREED with Workstream B (2026-07-19)

Both this spec (tagging accuracy + ranker offline eval) and Workstream B (extraction / design-coherence / critic evals) ride ONE harness. **Converged 2026-07-19** — B adopted this shape as the shared base (their spec §8d/§10.1, commit `553cbc2`); the only deltas are three **additive, optional, non-breaking** extensions B needs. Both specs now cite this identical harness.

**Core (required, identical for both workstreams):**

- **Location:** `apps/kol/src/lib/agents/evals/` (co-located with the shared LLM runner — extend it, don't fork).
- **Dataset format:** each eval file exports `export const goldenExamples: GoldenExample[]`, `GoldenExample = { id; input; expected; description; tags? }`. Min 10/feature; must cover happy-path, edge, adversarial, boundary. (B encodes its slop/good labels in the existing `tags?`, e.g. `['slop']`, `['good','unconventional']` — no new field.)
- **Runner:** `runEval(feature, examples, metric, threshold) → { passed, failed, meanScore, perExample[] }`; CI-fails if `meanScore < threshold` OR any adversarial example regresses.
- **Cost-log core (every LLM call, required):** `{ event:'llm_call', feature, model, input_tokens, output_tokens, cost_usd, latency_ms, ts }`; evals emit a per-run `eval_cost_usd`.

**Metric interface (with B's additive `breakdown?`):**
```ts
type Metric<I, O> = (out: O, expected: O, input: I) => {
  score:   number;                     // 0–1 (required)
  pass:    boolean;                    // required
  detail?: string;
  breakdown?: Record<string, number>;  // OPTIONAL (B's extension) — multi-component metrics,
                                        // e.g. B's extraction P/R/F1 + hallucinationRate, critic precision+recall.
                                        // MY metrics (tagging_accuracy, ranking_ndcg@k) do not set it.
};
```

**Cost-log optional block (either workstream MAY emit; my required core is unchanged):**
```ts
// appended to the core cost-log line when relevant:
{ cached_tokens?: number; trace_id?: string; store_id?: string; iteration?: number; outcome?: string }
// B uses trace_id (per-shop pipeline cost), iteration (regen-loop attribution), cached_tokens (cache-hit rate).
// I MAY emit cached_tokens for the tagging prompt-cache hit rate (§6.2); the rest are optional/unused by me.
```

**Named metrics on the harness:** mine — `tagging_accuracy`, `ranking_ndcg@k`; B's — `extraction_prf`, `design_coherence`, `critic_accuracy`. Disjoint; no collision. The **AI-ranker seam (§4) is mine (D5)**; B references it only.

**Status: AGREED / OQ-V1 RESOLVED.** The two additive optionals (`breakdown?`, cost-log optional block) are accepted — they extend, never break, the required core or my metrics.

---

## 8 · Cross-spec coordination + open questions

| # | Item | Status | Detail |
|---|------|--------|--------|
| OQ-V1 | **Shared eval harness convergence** | ✅ RESOLVED (2026-07-19) | AGREED with Workstream B — §7. B adopted this shape as base (their §8d/§10.1, `553cbc2`) + 3 additive optional extensions (`breakdown?`, cost-log optional block, `tags?`-encoded slop labels), all folded into §7. No breaking delta. |
| OQ-V2 | **Footage-tagging handoff / untagged-at-draft behaviour** | ✅ RESOLVED (2026-07-19) | Confirmed consistent with B: B's pipeline emits clip **references** (`stores.config.media.clips[].id` = `videos.id`), NOT inline profiles — matches ADR-0001 OQ-2 (engine reads the canonical tables; config is a mirror the engine ignores). **If footage is untagged at draft time:** its `video_profiles` arrays are empty (`'{}'` default, §0.2) → matches **no** eligibility query (every state requires a positive `page_eligibility` overlap) → **the engine never surfaces it** (safe-by-default, no wrong clip). B should surface an "untagged — won't appear" hint in the co-edit editor. **Untagged-signal reconciliation (P3): the canonical untagged signal is the `video_profiles` table state — a clip with no `video_profiles` row, or one whose arrays are absent/empty (`'{}'`) — the DB truth the engine acts on.** B's `pendingTag` flag is a **UI-side convenience mirror** for the editor hint; it does NOT gate the engine and is not a second source of truth. If the two ever disagree, the table state wins (the engine only ever reads the table). Note: the inline `videoProfile` shown in `store-config.schema.md` §2.3 is likewise a config-side mirror; canonical source-of-truth is `video_profiles` (ADR-0001) — this spec queries the table. Flagged to schema owner for the schema-doc wording alignment. |
| OQ-V3 | **Scoring weights (TBD post-launch)** | Deferred | §3.2 weights are launch defaults, not tuned. Need real interaction data to calibrate `w_relation` vs `w_freshness` (feed diversity vs affinity). Owner: ai-engineer post-launch, against buyer_signals + click-through. |
| OQ-V4 | **Anti-repetition storage** | Decided (MVP) | Session-scoped ephemeral (in-memory/cookie ring, §3.1), no new table. Revisit if cross-session "don't re-show" becomes a requirement — would need a `buyer_seen_clips` table (schema change, not in this phase). **Note (2026-07-22):** that revisit now also owns the exhaustion encore (§3.1) — a persistent seen-set makes exhaustion permanent, so a silent fresh lap would stop being the right behaviour. |
| OQ-V6 | **In-session pool exhaustion** | ✅ RESOLVED (2026-07-22) | §3.1 originally reset anti-repetition on **session expiry only**, so a session that consumed the whole eligible pool served empty until TTL — at launch scale (4 makers) that is minutes, and the feed's "You're all caught up" fires while eligible footage exists. Resolved with the **exhaustion encore** (§3.1): total exhaustion re-runs stage 3 on an empty ring and resets the ring to that lap. Engine-contract change (`risk:full`); structural test's pinned `visit3 == []` re-pinned to the fresh lap. |
| OQ-V5 | **AI-ranker seam ownership** | Owned here | The `Ranker` seam (§4) is this spec's (D5). Workstream B references it (a re-ranker could use interview-derived embeddings) but does not design it. B: read from the interface, don't fork it. |

---

## 9 · Build checklist (for the P6/P7 workers, later phase)

- [ ] `selectVideos(ctx)` composing `antiRepetition(ranker.rank(eligible(ctx)))` — three pure stages.
- [ ] Eligibility queries per §2 table; **FEED uses the positive `@> {'feed'}` predicate** (§2.1).
- [ ] Structural test: thankyou clip **never** in FEED, for any seed/buyer (§2.1) — load-bearing.
- [ ] `RulesRanker` implementing `Ranker` with §3.2 formula + `SCORING_WEIGHTS` const.
- [ ] Seeded jitter (no `Math.random`) so a session is reproducible, visits reshuffle (§3.3).
- [ ] Anti-repetition on `anti_repetition_key` (fallback `video_id`), session TTL per §3.1.
- [ ] Exhaustion encore (§3.1): ring-exhausted + non-empty ranked-eligible → fresh lap on a reset ring; empty *eligible* pool still returns empty.
- [ ] Relationship term: per-buyer `buyer_signals` query via **service role**; visit-cap + recency-decay + squash guards (§5.3).
- [ ] P7 tagging: manual editor UI + AI-assisted `TagSuggestion` (Haiku, cached prompt, §6.2) with 429/529 handling + cost log (§6.3).
- [ ] Tagging eval: ≥12 golden clips, `tagging_accuracy` macro-F1 ≥ 0.80, thankyou-gate 100% (§6.4).
- [ ] Ranker eval hook wired: any non-default ranker gated on offline `ranking_ndcg@k` before the flag flips (§4.2).
- [ ] Shared eval harness per §7 (converged with B).

---

*This is the ai-engineer build contract for P6/P7. The TypeScript engine, the LLM runner extension, and the eval files are later-phase worker deliverables implemented against this doc. The data model (`videos`/`video_profiles`/`buyer_signals`) is fixed by ADR-0001 and is NOT re-opened here — this spec only reads it.*
