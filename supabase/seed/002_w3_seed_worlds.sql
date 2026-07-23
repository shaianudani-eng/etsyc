-- ============================================================================
-- KOL MVP — Seed 002 · Wave-3 maker worlds  (DATA SEED — NOT a migration)
-- ----------------------------------------------------------------------------
-- Purpose:  Seed FOUR published maker worlds (profiles, stores + v1.3 configs,
--           videos, tagged video_profiles, media images, products,
--           product_specs) plus ONE unpublished probe store used to prove the
--           anon published-only RLS boundary. Until this seed lands, every
--           Wave-3 buyer surface (B1-B8) has nothing to render.
--
-- Access:   SERVICE-ROLE ONLY. Sellers cannot self-create these rows until S1
--           (Wave 4). The file sets the request.jwt.claims GUC to
--           '{"role":"service_role"}' (transaction-local) so
--           guard_profile_role() accepts the buyer->seller role step — the
--           exact escape hatch that trigger tests (auth.role() =
--           'service_role', per §B0). Never apply with a client/anon key.
--
-- How to apply — MANUAL RUNBOOK (operator-run; deliberately NO repo script,
-- per the standing policy in .claude/memory/DECISIONS.md, 2026-07-21):
--
--     psql "host=aws-1-us-east-2.pooler.supabase.com port=5432 \
--           dbname=postgres user=postgres.<project-ref> sslmode=require" \
--          -v ON_ERROR_STOP=1 -f supabase/seed/002_w3_seed_worlds.sql
--
--   Secret handling (non-negotiable):
--     * Password via ~/.pgpass or PGPASSFILE (chmod 600), or the passfile=
--       conninfo parameter — NEVER on argv, NEVER `set -a; source .env.local`.
--
--   Verify after apply (expected numbers):
--     select count(*) from public.stores  where id::text like '5eed%' and published;   -- 4
--     select count(*) from public.videos  where id::text like '5eed%';                 -- 20
--     select count(*) from public.video_profiles where id::text like '5eed%';          -- 20
--     select count(*) from public.products       where id::text like '5eed%';          -- 12
--     select count(*) from public.product_specs  where id::text like '5eed%';          -- 12
--     select count(*) from public.media          where id::text like '5eed%';          -- 16
--     -- feed predicate: exactly 4 rows, one per store, zero thankyou
--     select count(*) from public.video_profiles
--       where page_eligibility @> '{feed}' and purpose && '{intro,craft-story,atmosphere}';
--
-- Identity: every seeded row id carries the hex prefix 5eed (uuid-safe "seed"
--           marker). auth.users rows are synthetic identities with an INVALID
--           password (encrypted_password '') — they can never be logged into.
--
-- Media:    videos.src / poster point at COMMITTED public-domain placeholder
--           film + stills under apps/kol/public/seed/ (ffmpeg-generated
--           gradients + hand-authored SVGs; no third-party content).
--           Placeholder CONTENT, not placeholder UI: swapping in real footage
--           later is a src/poster URL update and nothing more.
--
-- Idempotent: YES. Deterministic ids; `on conflict (id) do update ... where
--           row is distinct` — a second run updates ZERO rows (provable via
--           checksum; updated_at untouched). auth.users uses do-nothing so
--           re-runs never touch auth state.
--
-- Rollback (exact, scoped — cascades remove ONLY seeded rows):
--   delete from auth.users where id in (
--     '5eed0001-0000-4000-8000-000000000001',
--     '5eed0001-0000-4000-8000-000000000002',
--     '5eed0001-0000-4000-8000-000000000003',
--     '5eed0001-0000-4000-8000-000000000004',
--     '5eed0001-0000-4000-8000-000000000099'
--   );
--   -- cascades: profiles -> stores -> videos -> video_profiles, media,
--   --           products -> product_specs. Nothing else carries the 5eed prefix.
-- ============================================================================

begin;

-- Transaction-local service-role claim: guard_profile_role() tests
-- auth.role() = 'service_role' (§B0's escape-hatch form) and psql connects as
-- postgres with no JWT, so the claim must be asserted explicitly.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);


-- --- 1 · auth.users (synthetic; invalid password; signup trigger seeds buyer profiles)
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000', '5eed0001-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'seed-wren@seed.example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Wren Hollis"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0001-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'seed-isolde@seed.example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Isolde Brandt"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0001-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'seed-mara@seed.example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Mara Okafor"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0001-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'seed-tomas@seed.example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Tomás Ferreira"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '5eed0001-0000-4000-8000-000000000099', 'authenticated', 'authenticated', 'seed-probe@seed.example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Seed Probe"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- --- 2 · profiles → seller (rows exist via signup trigger; role step needs the claim above)
insert into public.profiles (id, role, display_name, handle, avatar_url, bio)
values
  ('5eed0001-0000-4000-8000-000000000001', 'seller', 'Wren Hollis', 'hollowgrain', '/seed/hollowgrain/portrait.svg', 'I turn bowls and vessels from trees that came down in storms along the Kent coast. Nothing is felled for the work; every blank is salvage. The grain decides the shape — I just keep the gouge steady.'),
  ('5eed0001-0000-4000-8000-000000000002', 'seller', 'Isolde Brandt', 'isoldeglass', '/seed/isoldeglass/portrait.svg', 'Glass moves like water until the second it doesn''t. I blow each vessel in one continuous session at the furnace — no moulds, no second chances. The sea outside the window gets into everything I make.'),
  ('5eed0001-0000-4000-8000-000000000003', 'seller', 'Mara Okafor', 'maraleather', '/seed/maraleather/portrait.svg', 'Nine stitches to the inch, two needles, one thread waxed by hand. I cut every piece from English bridle leather and stitch it the way saddlers have for three hundred years. Slow is the point.'),
  ('5eed0001-0000-4000-8000-000000000004', 'seller', 'Tomás Ferreira', 'ferreirapress', '/seed/ferreirapress/portrait.svg', 'I set type by hand from a hundred-year-old case of Caslon and print on a restored Vandercook. Ink, pressure, paper — nothing else. Each edition is numbered and the type goes back in the case.'),
  ('5eed0001-0000-4000-8000-000000000099', 'seller', 'Seed Probe', 'seed-probe', null, 'Internal unpublished RLS probe.')
on conflict (id) do update set
  role = excluded.role, display_name = excluded.display_name,
  handle = excluded.handle, avatar_url = excluded.avatar_url, bio = excluded.bio
where (profiles.role, profiles.display_name, profiles.handle, profiles.avatar_url, profiles.bio)
  is distinct from
  (excluded.role, excluded.display_name, excluded.handle, excluded.avatar_url, excluded.bio);

-- --- 3 · stores (4 published worlds + 1 unpublished probe) -------------------

insert into public.stores (id, owner_id, handle, name, craft, bio, config, published)
values ('5eed0002-0000-4000-8000-000000000001', '5eed0001-0000-4000-8000-000000000001', 'hollowgrain', 'Hollow & Grain', 'Woodturner', 'I turn bowls and vessels from trees that came down in storms along the Kent coast. Nothing is felled for the work; every blank is salvage. The grain decides the shape — I just keep the gouge steady.',
$cfg${
  "schemaVersion": "1.3",
  "storeId": "5eed0002-0000-4000-8000-000000000001",
  "maker": {
    "id": "5eed0001-0000-4000-8000-000000000001",
    "displayName": "Wren Hollis",
    "handle": "hollowgrain",
    "craft": "Woodturner",
    "location": "Whitstable, Kent",
    "bio": "I turn bowls and vessels from trees that came down in storms along the Kent coast. Nothing is felled for the work; every blank is salvage. The grain decides the shape — I just keep the gouge steady.",
    "avatarMediaId": "5eed0007-0000-4000-8000-000000000011",
    "trust": {
      "realMaker": {
        "status": "verified",
        "verifiedAt": "2026-07-18T10:00:00Z",
        "voiceAnchorClipId": "5eed0003-0000-4000-8000-000000000011"
      },
      "aiTransparency": {
        "level": "maker-authored",
        "disclosure": "Every word on this page is Wren's own.",
        "aiAssistedFields": []
      }
    }
  },
  "theme": {
    "kind": "curated",
    "paletteId": "orchard",
    "mode": "light",
    "fontPairingId": "warm-serif",
    "motionPreset": "fluid",
    "radiusIdentity": "soft",
    "density": "airy"
  },
  "media": {
    "clips": [
      {
        "id": "5eed0003-0000-4000-8000-000000000011",
        "kind": "video",
        "src": "/seed/hollowgrain/intro.mp4",
        "poster": "/seed/hollowgrain/intro-poster.svg",
        "durationMs": 9000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.32
        },
        "videoProfile": {
          "purpose": [
            "intro"
          ],
          "pageEligibility": [
            "feed",
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "warm",
            "calm"
          ],
          "antiRepetitionKey": "hollowgrain-intro"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000012",
        "kind": "video",
        "src": "/seed/hollowgrain/story.mp4",
        "poster": "/seed/hollowgrain/story-poster.svg",
        "durationMs": 14000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.42,
          "y": 0.38
        },
        "videoProfile": {
          "purpose": [
            "craft-story"
          ],
          "pageEligibility": [
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "intimate"
          ],
          "antiRepetitionKey": "hollowgrain-story"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000013",
        "kind": "video",
        "src": "/seed/hollowgrain/process.mp4",
        "poster": "/seed/hollowgrain/process-poster.svg",
        "durationMs": 18000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.55,
          "y": 0.45
        },
        "videoProfile": {
          "purpose": [
            "process"
          ],
          "pageEligibility": [
            "world"
          ],
          "productLinks": [],
          "mood": [
            "calm"
          ],
          "antiRepetitionKey": "hollowgrain-lathe"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000014",
        "kind": "video",
        "src": "/seed/hollowgrain/narration.mp4",
        "poster": "/seed/hollowgrain/narration-poster.svg",
        "durationMs": 11000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.4
        },
        "videoProfile": {
          "purpose": [
            "product-narration"
          ],
          "pageEligibility": [
            "product"
          ],
          "productLinks": [
            "5eed0005-0000-4000-8000-000000000011"
          ],
          "mood": [
            "intimate",
            "calm"
          ],
          "antiRepetitionKey": "hollowgrain-storm-oak-bowl"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000015",
        "kind": "video",
        "src": "/seed/hollowgrain/thanks.mp4",
        "poster": "/seed/hollowgrain/thanks-poster.svg",
        "durationMs": 7000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.3
        },
        "videoProfile": {
          "purpose": [
            "thankyou"
          ],
          "pageEligibility": [
            "thankyou"
          ],
          "productLinks": [],
          "mood": [
            "warm"
          ],
          "antiRepetitionKey": "hollowgrain-thanks"
        }
      }
    ],
    "images": [
      {
        "id": "5eed0007-0000-4000-8000-000000000011",
        "src": "/seed/hollowgrain/portrait.svg",
        "alt": "Wren Hollis at the lathe",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.5,
          "y": 0.35
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000012",
        "src": "/seed/hollowgrain/storm-oak-bowl.svg",
        "alt": "Storm Oak Bowl, oiled finish",
        "aspect": "1:1",
        "focalPoint": {
          "x": 0.5,
          "y": 0.55
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000013",
        "src": "/seed/hollowgrain/spalted-vessel.svg",
        "alt": "Spalted Beech Vessel, ink-line figuring",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.5,
          "y": 0.5
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000014",
        "src": "/seed/hollowgrain/walnut-boards.svg",
        "alt": "Pair of walnut serving boards",
        "aspect": "3:2",
        "focalPoint": {
          "x": 0.5,
          "y": 0.5
        }
      }
    ]
  },
  "products": [
    {
      "id": "5eed0005-0000-4000-8000-000000000011",
      "title": "Storm Oak Bowl",
      "price": {
        "amount": 14500,
        "currency": "GBP"
      },
      "description": "Turned from a single oak blank brought down in the January storms. Open grain, oiled to a soft sheen — the split the storm started is stitched with a bronze butterfly.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000012"
      ],
      "model3dId": null,
      "narrationClipTags": [
        "5eed0003-0000-4000-8000-000000000014"
      ],
      "inventory": {
        "status": "in-stock",
        "qty": 1
      },
      "badges": [
        "one-of-a-kind"
      ]
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000012",
      "title": "Spalted Beech Vessel",
      "price": {
        "amount": 21000,
        "currency": "GBP"
      },
      "description": "A tall closed form in spalted beech — the black ink-lines are the tree's own weather diary. Sold, but a commission can chase the same figure.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000013"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "sold-out",
        "qty": 0
      },
      "badges": [
        "one-of-a-kind"
      ]
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000013",
      "title": "Walnut Serving Boards, pair",
      "price": {
        "amount": 8500,
        "currency": "GBP"
      },
      "description": "Two long boards from the same walnut plank, so the grain runs across the pair when they sit together. Made to order, oiled and waxed.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000014"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "made-to-order",
        "qty": null
      },
      "badges": [
        "made-to-order"
      ]
    }
  ],
  "voiceovers": [],
  "blocks": [
    {
      "id": "w1-hero",
      "type": "hero-video",
      "variant": "full-bleed",
      "order": 0,
      "props": {
        "showCraftLine": true,
        "statement": "Turned from storm-felled oak"
      },
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000011"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w1-story",
      "type": "craft-story",
      "variant": "text-left-media-right",
      "order": 1,
      "props": {
        "heading": "Nothing is felled for the work",
        "body": "Every blank in this workshop came down in weather. I haul them off beaches and out of hedgerows, seal the ends, and wait — sometimes years — for the wood to decide what it wants to be. Then the lathe gets its say.",
        "blockGround": "a"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [
          "5eed0007-0000-4000-8000-000000000011"
        ],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w1-reel",
      "type": "process-reel",
      "variant": "single-reel",
      "order": 2,
      "props": {
        "caption": "One bowl, from blank to oil"
      },
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000013"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w1-shop",
      "type": "product-showcase",
      "variant": "rail",
      "order": 3,
      "props": {
        "eyebrow": "From the storm pile"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [
          "5eed0005-0000-4000-8000-000000000011",
          "5eed0005-0000-4000-8000-000000000012",
          "5eed0005-0000-4000-8000-000000000013"
        ],
        "voiceoverIds": []
      }
    },
    {
      "id": "w1-quote",
      "type": "voice-quote",
      "variant": "text-only",
      "order": 4,
      "props": {
        "quote": "The grain decides. I just keep the gouge steady.",
        "attribution": "Wren, at the lathe",
        "blockGround": "b"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w1-trust",
      "type": "trust-badge",
      "variant": "inline-compact",
      "order": 5,
      "props": {},
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000011"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w1-cta",
      "type": "contact-cta",
      "variant": "footer-strip",
      "order": 6,
      "props": {
        "label": "Commission a turning",
        "blockGround": "a"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    }
  ],
  "meta": {
    "version": 1,
    "status": "published",
    "criticScore": 0.9,
    "approvedSections": [
      "w1-hero",
      "w1-story",
      "w1-reel",
      "w1-shop",
      "w1-quote",
      "w1-trust",
      "w1-cta"
    ],
    "createdAt": "2026-07-21T09:00:00Z",
    "updatedAt": "2026-07-22T08:00:00Z"
  }
}$cfg$::jsonb, true)
on conflict (id) do update set
  owner_id = excluded.owner_id, handle = excluded.handle, name = excluded.name,
  craft = excluded.craft, bio = excluded.bio, config = excluded.config, published = excluded.published
where (stores.owner_id, stores.handle, stores.name, stores.craft, stores.bio, stores.config, stores.published)
  is distinct from
  (excluded.owner_id, excluded.handle, excluded.name, excluded.craft, excluded.bio, excluded.config, excluded.published);

insert into public.stores (id, owner_id, handle, name, craft, bio, config, published)
values ('5eed0002-0000-4000-8000-000000000002', '5eed0001-0000-4000-8000-000000000002', 'isoldeglass', 'Isolde Glass', 'Glassblower', 'Glass moves like water until the second it doesn''t. I blow each vessel in one continuous session at the furnace — no moulds, no second chances. The sea outside the window gets into everything I make.',
$cfg${
  "schemaVersion": "1.3",
  "storeId": "5eed0002-0000-4000-8000-000000000002",
  "maker": {
    "id": "5eed0001-0000-4000-8000-000000000002",
    "displayName": "Isolde Brandt",
    "handle": "isoldeglass",
    "craft": "Glassblower",
    "location": "Bristol",
    "bio": "Glass moves like water until the second it doesn't. I blow each vessel in one continuous session at the furnace — no moulds, no second chances. The sea outside the window gets into everything I make.",
    "avatarMediaId": "5eed0007-0000-4000-8000-000000000021",
    "trust": {
      "realMaker": {
        "status": "verified",
        "verifiedAt": "2026-07-19T15:30:00Z",
        "voiceAnchorClipId": "5eed0003-0000-4000-8000-000000000021"
      },
      "aiTransparency": {
        "level": "ai-assisted",
        "disclosure": "Isolde wrote these words. KOL's AI suggested the page layout; Isolde approved every section.",
        "aiAssistedFields": [
          "layout"
        ]
      }
    }
  },
  "theme": {
    "kind": "custom",
    "customPalette": {
      "mode": "dark",
      "roles": {
        "bg": "#101b1e",
        "surface": "#16262b",
        "ink": "#e8f1f2",
        "inkMuted": "#9fb8bc",
        "accent": "#ffb454",
        "accentInk": "#1a1205",
        "border": "#2a3f45"
      }
    },
    "customPairing": {
      "displayFamily": "Clash Display",
      "textFamily": "General Sans",
      "scaleRatio": 1.25,
      "displayWeight": 600,
      "textWeight": 400
    },
    "motionPreset": "liquid",
    "radiusIdentity": "sharp",
    "density": "standard"
  },
  "media": {
    "clips": [
      {
        "id": "5eed0003-0000-4000-8000-000000000021",
        "kind": "video",
        "src": "/seed/isoldeglass/intro.mp4",
        "poster": "/seed/isoldeglass/intro-poster.svg",
        "durationMs": 8000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.48,
          "y": 0.3
        },
        "videoProfile": {
          "purpose": [
            "intro"
          ],
          "pageEligibility": [
            "feed",
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "warm",
            "energetic"
          ],
          "antiRepetitionKey": "isoldeglass-intro"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000022",
        "kind": "video",
        "src": "/seed/isoldeglass/story.mp4",
        "poster": "/seed/isoldeglass/story-poster.svg",
        "durationMs": 13000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.36
        },
        "videoProfile": {
          "purpose": [
            "craft-story"
          ],
          "pageEligibility": [
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "intimate"
          ],
          "antiRepetitionKey": "isoldeglass-story"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000023",
        "kind": "video",
        "src": "/seed/isoldeglass/process.mp4",
        "poster": "/seed/isoldeglass/process-poster.svg",
        "durationMs": 16000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.6,
          "y": 0.42
        },
        "videoProfile": {
          "purpose": [
            "process"
          ],
          "pageEligibility": [
            "world"
          ],
          "productLinks": [],
          "mood": [
            "energetic"
          ],
          "antiRepetitionKey": "isoldeglass-furnace"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000024",
        "kind": "video",
        "src": "/seed/isoldeglass/narration.mp4",
        "poster": "/seed/isoldeglass/narration-poster.svg",
        "durationMs": 12000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.44
        },
        "videoProfile": {
          "purpose": [
            "product-narration"
          ],
          "pageEligibility": [
            "product"
          ],
          "productLinks": [
            "5eed0005-0000-4000-8000-000000000021"
          ],
          "mood": [
            "calm"
          ],
          "antiRepetitionKey": "isoldeglass-sea-smoke"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000025",
        "kind": "video",
        "src": "/seed/isoldeglass/thanks.mp4",
        "poster": "/seed/isoldeglass/thanks-poster.svg",
        "durationMs": 6000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.3
        },
        "videoProfile": {
          "purpose": [
            "thankyou"
          ],
          "pageEligibility": [
            "thankyou"
          ],
          "productLinks": [],
          "mood": [
            "warm",
            "intimate"
          ],
          "antiRepetitionKey": "isoldeglass-thanks"
        }
      }
    ],
    "images": [
      {
        "id": "5eed0007-0000-4000-8000-000000000021",
        "src": "/seed/isoldeglass/portrait.svg",
        "alt": "Isolde Brandt at the furnace door",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.46,
          "y": 0.34
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000022",
        "src": "/seed/isoldeglass/sea-smoke-tumblers.svg",
        "alt": "Sea Smoke Tumblers, set of four",
        "aspect": "1:1",
        "focalPoint": {
          "x": 0.5,
          "y": 0.5
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000023",
        "src": "/seed/isoldeglass/amber-swell-vase.svg",
        "alt": "Amber Swell Vase, lit from behind",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.5,
          "y": 0.48
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000024",
        "src": "/seed/isoldeglass/tide-line-carafe.svg",
        "alt": "Tide Line Carafe with two glasses",
        "aspect": "3:2",
        "focalPoint": {
          "x": 0.44,
          "y": 0.5
        }
      }
    ]
  },
  "products": [
    {
      "id": "5eed0005-0000-4000-8000-000000000021",
      "title": "Sea Smoke Tumblers, set of four",
      "price": {
        "amount": 12000,
        "currency": "GBP"
      },
      "description": "Four tumblers in fog grey with a drifting white veil trapped in the wall. Blown in one session so the set breathes together.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000022"
      ],
      "model3dId": null,
      "narrationClipTags": [
        "5eed0003-0000-4000-8000-000000000024"
      ],
      "inventory": {
        "status": "in-stock",
        "qty": 8
      },
      "badges": [
        "limited"
      ]
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000022",
      "title": "Amber Swell Vase",
      "price": {
        "amount": 34000,
        "currency": "GBP"
      },
      "description": "One gather, one breath, one wave of amber caught mid-swell. The lean is deliberate — the glass wanted it.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000023"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "in-stock",
        "qty": 1
      },
      "badges": [
        "one-of-a-kind"
      ]
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000023",
      "title": "Tide Line Carafe",
      "price": {
        "amount": 19000,
        "currency": "GBP"
      },
      "description": "A litre carafe with a green tide line rolled into the shoulder. Made to order, each line lands where the day's tide left it.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000024"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "made-to-order",
        "qty": null
      },
      "badges": [
        "made-to-order"
      ]
    }
  ],
  "voiceovers": [],
  "blocks": [
    {
      "id": "w2-hero",
      "type": "hero-video",
      "variant": "center-column",
      "order": 0,
      "props": {
        "showCraftLine": true,
        "statement": "Vessels blown in one breath"
      },
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000021"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w2-wash",
      "type": "atmosphere",
      "variant": "color-wash",
      "order": 1,
      "props": {
        "toneShift": "cool",
        "blockGround": "c"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w2-story",
      "type": "craft-story",
      "variant": "stacked-editorial",
      "order": 2,
      "props": {
        "heading": "No moulds, no second chances",
        "body": "A vessel happens in the four minutes the glass stays honest. I gather, I breathe, I turn — and when it leans, I listen. The furnace runs at 1120°C and the sea runs the palette; fog greys, tide greens, one stripe of amber for the days the sun gets through.",
        "blockGround": "b"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [
          "5eed0007-0000-4000-8000-000000000021"
        ],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w2-shop",
      "type": "product-showcase",
      "variant": "masonry",
      "order": 3,
      "props": {
        "heading": "This month from the furnace"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [
          "5eed0005-0000-4000-8000-000000000021",
          "5eed0005-0000-4000-8000-000000000022",
          "5eed0005-0000-4000-8000-000000000023"
        ],
        "voiceoverIds": []
      }
    },
    {
      "id": "w2-reel",
      "type": "process-reel",
      "variant": "multi-clip-carousel",
      "order": 4,
      "props": {
        "caption": "Gather, breathe, break off"
      },
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000023",
          "5eed0003-0000-4000-8000-000000000022"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w2-quote",
      "type": "voice-quote",
      "variant": "text-only",
      "order": 5,
      "props": {
        "quote": "If the glass wants to lean, let it lean.",
        "blockGround": "c"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w2-thanks",
      "type": "thank-you",
      "variant": "video-message",
      "order": 6,
      "props": {
        "message": "Thank you — every order keeps the furnace lit."
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w2-cta",
      "type": "contact-cta",
      "variant": "card",
      "order": 7,
      "props": {
        "label": "Ask about a commission",
        "blockGround": "b"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    }
  ],
  "meta": {
    "version": 1,
    "status": "published",
    "criticScore": 0.9,
    "approvedSections": [
      "w2-hero",
      "w2-wash",
      "w2-story",
      "w2-shop",
      "w2-reel",
      "w2-quote",
      "w2-thanks",
      "w2-cta"
    ],
    "createdAt": "2026-07-21T09:00:00Z",
    "updatedAt": "2026-07-22T08:00:00Z"
  }
}$cfg$::jsonb, true)
on conflict (id) do update set
  owner_id = excluded.owner_id, handle = excluded.handle, name = excluded.name,
  craft = excluded.craft, bio = excluded.bio, config = excluded.config, published = excluded.published
where (stores.owner_id, stores.handle, stores.name, stores.craft, stores.bio, stores.config, stores.published)
  is distinct from
  (excluded.owner_id, excluded.handle, excluded.name, excluded.craft, excluded.bio, excluded.config, excluded.published);

insert into public.stores (id, owner_id, handle, name, craft, bio, config, published)
values ('5eed0002-0000-4000-8000-000000000003', '5eed0001-0000-4000-8000-000000000003', 'maraleather', 'Mara Okafor Leather', 'Leatherworker', 'Nine stitches to the inch, two needles, one thread waxed by hand. I cut every piece from English bridle leather and stitch it the way saddlers have for three hundred years. Slow is the point.',
$cfg${
  "schemaVersion": "1.3",
  "storeId": "5eed0002-0000-4000-8000-000000000003",
  "maker": {
    "id": "5eed0001-0000-4000-8000-000000000003",
    "displayName": "Mara Okafor",
    "handle": "maraleather",
    "craft": "Leatherworker",
    "location": "Walthamstow, London",
    "bio": "Nine stitches to the inch, two needles, one thread waxed by hand. I cut every piece from English bridle leather and stitch it the way saddlers have for three hundred years. Slow is the point.",
    "avatarMediaId": "5eed0007-0000-4000-8000-000000000031",
    "trust": {
      "realMaker": {
        "status": "pending",
        "verifiedAt": null,
        "voiceAnchorClipId": null
      },
      "aiTransparency": {
        "level": "maker-authored",
        "disclosure": "Written by Mara, unedited.",
        "aiAssistedFields": []
      }
    }
  },
  "theme": {
    "kind": "curated",
    "paletteId": "market-plum",
    "mode": "dark",
    "fontPairingId": "modern-mono-grotesk",
    "motionPreset": "hushed",
    "radiusIdentity": "sharp",
    "density": "standard"
  },
  "media": {
    "clips": [
      {
        "id": "5eed0003-0000-4000-8000-000000000031",
        "kind": "video",
        "src": "/seed/maraleather/intro.mp4",
        "poster": "/seed/maraleather/intro-poster.svg",
        "durationMs": 10000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.52,
          "y": 0.3
        },
        "videoProfile": {
          "purpose": [
            "intro"
          ],
          "pageEligibility": [
            "feed",
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "calm"
          ],
          "antiRepetitionKey": "maraleather-intro"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000032",
        "kind": "video",
        "src": "/seed/maraleather/story.mp4",
        "poster": "/seed/maraleather/story-poster.svg",
        "durationMs": 15000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.45,
          "y": 0.35
        },
        "videoProfile": {
          "purpose": [
            "craft-story"
          ],
          "pageEligibility": [
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "intimate",
            "calm"
          ],
          "antiRepetitionKey": "maraleather-story"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000033",
        "kind": "video",
        "src": "/seed/maraleather/process.mp4",
        "poster": "/seed/maraleather/process-poster.svg",
        "durationMs": 17000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.5
        },
        "videoProfile": {
          "purpose": [
            "process"
          ],
          "pageEligibility": [
            "world"
          ],
          "productLinks": [],
          "mood": [
            "calm"
          ],
          "antiRepetitionKey": "maraleather-stitch"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000034",
        "kind": "video",
        "src": "/seed/maraleather/narration.mp4",
        "poster": "/seed/maraleather/narration-poster.svg",
        "durationMs": 9000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.42
        },
        "videoProfile": {
          "purpose": [
            "product-narration"
          ],
          "pageEligibility": [
            "product"
          ],
          "productLinks": [
            "5eed0005-0000-4000-8000-000000000031"
          ],
          "mood": [
            "intimate"
          ],
          "antiRepetitionKey": "maraleather-ninefold"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000035",
        "kind": "video",
        "src": "/seed/maraleather/thanks.mp4",
        "poster": "/seed/maraleather/thanks-poster.svg",
        "durationMs": 7000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.32
        },
        "videoProfile": {
          "purpose": [
            "thankyou"
          ],
          "pageEligibility": [
            "thankyou"
          ],
          "productLinks": [],
          "mood": [
            "warm"
          ],
          "antiRepetitionKey": "maraleather-thanks"
        }
      }
    ],
    "images": [
      {
        "id": "5eed0007-0000-4000-8000-000000000031",
        "src": "/seed/maraleather/portrait.svg",
        "alt": "Mara Okafor at the stitching pony",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.5,
          "y": 0.33
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000032",
        "src": "/seed/maraleather/ninefold-belt.svg",
        "alt": "Ninefold Belt coiled on the bench",
        "aspect": "3:2",
        "focalPoint": {
          "x": 0.5,
          "y": 0.5
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000033",
        "src": "/seed/maraleather/oxblood-sleeve.svg",
        "alt": "Card Sleeve in oxblood bridle leather",
        "aspect": "1:1",
        "focalPoint": {
          "x": 0.5,
          "y": 0.5
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000034",
        "src": "/seed/maraleather/weekend-holdall.svg",
        "alt": "Weekend Holdall, one hide, brass hardware",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.5,
          "y": 0.45
        }
      }
    ]
  },
  "products": [
    {
      "id": "5eed0005-0000-4000-8000-000000000031",
      "title": "Ninefold Belt",
      "price": {
        "amount": 9500,
        "currency": "GBP"
      },
      "description": "One strap of English bridle leather, nine stitches to the inch where the buckle turns. Made to your waist, not a size chart.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000032"
      ],
      "model3dId": null,
      "narrationClipTags": [
        "5eed0003-0000-4000-8000-000000000034"
      ],
      "inventory": {
        "status": "made-to-order",
        "qty": null
      },
      "badges": [
        "made-to-order"
      ]
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000032",
      "title": "Card Sleeve in Oxblood",
      "price": {
        "amount": 4800,
        "currency": "GBP"
      },
      "description": "Four cards, folded notes, nothing else. One piece of leather, one line of saddle stitch, edges burnished until they shine.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000033"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "in-stock",
        "qty": 14
      },
      "badges": []
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000033",
      "title": "Weekend Holdall",
      "price": {
        "amount": 52000,
        "currency": "GBP"
      },
      "description": "Cut from a single hide so the grain runs unbroken around the body. Brass feet, saddle-stitched handles, a lifetime guarantee measured in decades. Sold.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000034"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "sold-out",
        "qty": 0
      },
      "badges": [
        "one-of-a-kind"
      ]
    }
  ],
  "voiceovers": [],
  "blocks": [
    {
      "id": "w3-hero",
      "type": "hero-video",
      "variant": "full-bleed",
      "order": 0,
      "props": {
        "showCraftLine": false,
        "statement": "Nine stitches to the inch"
      },
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000031"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w3-feature",
      "type": "product-showcase",
      "variant": "featured-single",
      "order": 1,
      "props": {
        "eyebrow": "One hide, one bag",
        "heading": "The Weekend Holdall"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [
          "5eed0005-0000-4000-8000-000000000033",
          "5eed0005-0000-4000-8000-000000000031",
          "5eed0005-0000-4000-8000-000000000032"
        ],
        "voiceoverIds": []
      }
    },
    {
      "id": "w3-story",
      "type": "craft-story",
      "variant": "pull-quote",
      "order": 2,
      "props": {
        "heading": "Three hundred years of stitch",
        "body": "A saddle stitch is two needles crossing inside the leather, locking every stitch independently — a machine cannot make it, and a broken thread cannot run. I learned it the long way and I am not in a hurry.",
        "pullQuote": "Slow is the point.",
        "blockGround": "b"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [
          "5eed0007-0000-4000-8000-000000000031"
        ],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w3-band",
      "type": "atmosphere",
      "variant": "image-band",
      "order": 3,
      "props": {
        "toneShift": "neutral"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [
          "5eed0007-0000-4000-8000-000000000032"
        ],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w3-trust",
      "type": "trust-badge",
      "variant": "expandable-detail",
      "order": 4,
      "props": {},
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000031"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w3-cta",
      "type": "contact-cta",
      "variant": "button",
      "order": 5,
      "props": {
        "label": "Message Mara",
        "blockGround": "a"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    }
  ],
  "meta": {
    "version": 1,
    "status": "published",
    "criticScore": 0.9,
    "approvedSections": [
      "w3-hero",
      "w3-feature",
      "w3-story",
      "w3-band",
      "w3-trust",
      "w3-cta"
    ],
    "createdAt": "2026-07-21T09:00:00Z",
    "updatedAt": "2026-07-22T08:00:00Z"
  }
}$cfg$::jsonb, true)
on conflict (id) do update set
  owner_id = excluded.owner_id, handle = excluded.handle, name = excluded.name,
  craft = excluded.craft, bio = excluded.bio, config = excluded.config, published = excluded.published
where (stores.owner_id, stores.handle, stores.name, stores.craft, stores.bio, stores.config, stores.published)
  is distinct from
  (excluded.owner_id, excluded.handle, excluded.name, excluded.craft, excluded.bio, excluded.config, excluded.published);

insert into public.stores (id, owner_id, handle, name, craft, bio, config, published)
values ('5eed0002-0000-4000-8000-000000000004', '5eed0001-0000-4000-8000-000000000004', 'ferreirapress', 'Ferreira Press', 'Letterpress printer', 'I set type by hand from a hundred-year-old case of Caslon and print on a restored Vandercook. Ink, pressure, paper — nothing else. Each edition is numbered and the type goes back in the case.',
$cfg${
  "schemaVersion": "1.3",
  "storeId": "5eed0002-0000-4000-8000-000000000004",
  "maker": {
    "id": "5eed0001-0000-4000-8000-000000000004",
    "displayName": "Tomás Ferreira",
    "handle": "ferreirapress",
    "craft": "Letterpress printer",
    "location": "Leeds",
    "bio": "I set type by hand from a hundred-year-old case of Caslon and print on a restored Vandercook. Ink, pressure, paper — nothing else. Each edition is numbered and the type goes back in the case.",
    "avatarMediaId": "5eed0007-0000-4000-8000-000000000041",
    "trust": {
      "realMaker": {
        "status": "verified",
        "verifiedAt": "2026-07-20T09:45:00Z",
        "voiceAnchorClipId": "5eed0003-0000-4000-8000-000000000041"
      },
      "aiTransparency": {
        "level": "ai-assisted",
        "disclosure": "Tomás wrote every line; KOL's AI tidied the product descriptions and Tomás approved each one.",
        "aiAssistedFields": [
          "products.description"
        ]
      }
    }
  },
  "theme": {
    "kind": "custom",
    "customPalette": {
      "mode": "light",
      "roles": {
        "bg": "#f7f2e9",
        "surface": "#fffdf7",
        "ink": "#1c1917",
        "inkMuted": "#57514a",
        "accent": "#b5310c",
        "accentInk": "#fff7ef",
        "border": "#d8cfc0"
      }
    },
    "customPairing": {
      "displayFamily": "Fraunces",
      "textFamily": "Satoshi",
      "scaleRatio": 1.2,
      "displayWeight": 700,
      "textWeight": 400,
      "strokeClass": "modulated"
    },
    "motionPreset": "fluid",
    "radiusIdentity": "round",
    "density": "airy"
  },
  "media": {
    "clips": [
      {
        "id": "5eed0003-0000-4000-8000-000000000041",
        "kind": "video",
        "src": "/seed/ferreirapress/intro.mp4",
        "poster": "/seed/ferreirapress/intro-poster.svg",
        "durationMs": 9000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.34
        },
        "videoProfile": {
          "purpose": [
            "intro"
          ],
          "pageEligibility": [
            "feed",
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "warm"
          ],
          "antiRepetitionKey": "ferreirapress-intro"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000042",
        "kind": "video",
        "src": "/seed/ferreirapress/story.mp4",
        "poster": "/seed/ferreirapress/story-poster.svg",
        "durationMs": 12000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.4,
          "y": 0.4
        },
        "videoProfile": {
          "purpose": [
            "craft-story"
          ],
          "pageEligibility": [
            "grown",
            "world"
          ],
          "productLinks": [],
          "mood": [
            "calm"
          ],
          "antiRepetitionKey": "ferreirapress-story"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000043",
        "kind": "video",
        "src": "/seed/ferreirapress/process.mp4",
        "poster": "/seed/ferreirapress/process-poster.svg",
        "durationMs": 19000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.58,
          "y": 0.46
        },
        "videoProfile": {
          "purpose": [
            "process"
          ],
          "pageEligibility": [
            "world"
          ],
          "productLinks": [],
          "mood": [
            "energetic"
          ],
          "antiRepetitionKey": "ferreirapress-vandercook"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000044",
        "kind": "video",
        "src": "/seed/ferreirapress/narration.mp4",
        "poster": "/seed/ferreirapress/narration-poster.svg",
        "durationMs": 10000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.38
        },
        "videoProfile": {
          "purpose": [
            "product-narration"
          ],
          "pageEligibility": [
            "product"
          ],
          "productLinks": [
            "5eed0005-0000-4000-8000-000000000041"
          ],
          "mood": [
            "intimate"
          ],
          "antiRepetitionKey": "ferreirapress-broadside"
        }
      },
      {
        "id": "5eed0003-0000-4000-8000-000000000045",
        "kind": "video",
        "src": "/seed/ferreirapress/thanks.mp4",
        "poster": "/seed/ferreirapress/thanks-poster.svg",
        "durationMs": 8000,
        "captionsSrc": null,
        "focalPoint": {
          "x": 0.5,
          "y": 0.3
        },
        "videoProfile": {
          "purpose": [
            "thankyou"
          ],
          "pageEligibility": [
            "thankyou"
          ],
          "productLinks": [],
          "mood": [
            "warm"
          ],
          "antiRepetitionKey": "ferreirapress-thanks"
        }
      }
    ],
    "images": [
      {
        "id": "5eed0007-0000-4000-8000-000000000041",
        "src": "/seed/ferreirapress/portrait.svg",
        "alt": "Tomás Ferreira pulling a proof on the Vandercook",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.48,
          "y": 0.32
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000042",
        "src": "/seed/ferreirapress/broadside-12.svg",
        "alt": "Broadside No. 12, vermilion and black on cream",
        "aspect": "4:5",
        "focalPoint": {
          "x": 0.5,
          "y": 0.42
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000043",
        "src": "/seed/ferreirapress/caslon-notebook.svg",
        "alt": "Hand-bound notebook, Caslon edition",
        "aspect": "1:1",
        "focalPoint": {
          "x": 0.5,
          "y": 0.5
        }
      },
      {
        "id": "5eed0007-0000-4000-8000-000000000044",
        "src": "/seed/ferreirapress/press-room.svg",
        "alt": "The press room: type cases and the Vandercook",
        "aspect": "3:2",
        "focalPoint": {
          "x": 0.42,
          "y": 0.5
        }
      }
    ]
  },
  "products": [
    {
      "id": "5eed0005-0000-4000-8000-000000000041",
      "title": "Broadside No. 12 — The Sea Gives Back",
      "price": {
        "amount": 6500,
        "currency": "GBP"
      },
      "description": "A two-colour broadside set in 36 pt Caslon, printed in three passes on 300 gsm cotton rag. Edition of 40, numbered and signed in pencil.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000042"
      ],
      "model3dId": null,
      "narrationClipTags": [
        "5eed0003-0000-4000-8000-000000000044"
      ],
      "inventory": {
        "status": "in-stock",
        "qty": 24
      },
      "badges": [
        "limited"
      ]
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000042",
      "title": "Hand-bound Notebook, Caslon Edition",
      "price": {
        "amount": 4200,
        "currency": "GBP"
      },
      "description": "96 pages of Munken laid stock, section-sewn, with a letterpress cover set in Caslon ornaments. Lies flat from page one.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000043"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "in-stock",
        "qty": 11
      },
      "badges": []
    },
    {
      "id": "5eed0005-0000-4000-8000-000000000043",
      "title": "Wedding Suite, hand-set (per 50)",
      "price": {
        "amount": 28000,
        "currency": "GBP"
      },
      "description": "Invitations, RSVPs and details cards, hand-set in Caslon and printed on the Vandercook. Priced per fifty; every suite starts with a proofing visit or video call.",
      "mediaIds": [
        "5eed0007-0000-4000-8000-000000000044"
      ],
      "model3dId": null,
      "narrationClipTags": [],
      "inventory": {
        "status": "made-to-order",
        "qty": null
      },
      "badges": [
        "made-to-order"
      ]
    }
  ],
  "voiceovers": [],
  "blocks": [
    {
      "id": "w4-hero",
      "type": "hero-video",
      "variant": "center-column",
      "order": 0,
      "props": {
        "showCraftLine": true,
        "statement": "Set by hand, letter by letter"
      },
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000041"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-divide",
      "type": "atmosphere",
      "variant": "motion-divider",
      "order": 1,
      "props": {
        "toneShift": "warm"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-story",
      "type": "craft-story",
      "variant": "text-left-media-right",
      "order": 2,
      "props": {
        "heading": "A hundred-year case of Caslon",
        "body": "The type in this shop outlived the foundry that cast it. Setting it by hand means every line is a negotiation with metal that has opinions — and when the forme locks up square, the Vandercook does the rest. Ink, pressure, paper. Nothing else.",
        "blockGround": "a"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [
          "5eed0007-0000-4000-8000-000000000044"
        ],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-reel",
      "type": "process-reel",
      "variant": "single-reel",
      "order": 3,
      "props": {
        "caption": "One broadside, three passes"
      },
      "bindings": {
        "clipTags": [
          "5eed0003-0000-4000-8000-000000000043"
        ],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-shop",
      "type": "product-showcase",
      "variant": "masonry",
      "order": 4,
      "props": {
        "eyebrow": "Editions",
        "heading": "Numbered and signed"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [
          "5eed0005-0000-4000-8000-000000000041",
          "5eed0005-0000-4000-8000-000000000042",
          "5eed0005-0000-4000-8000-000000000043"
        ],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-detail",
      "type": "product-detail",
      "variant": "image-gallery",
      "order": 5,
      "props": {
        "showModel3d": false
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [
          "5eed0007-0000-4000-8000-000000000042"
        ],
        "productIds": [
          "5eed0005-0000-4000-8000-000000000041"
        ],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-quote",
      "type": "voice-quote",
      "variant": "text-only",
      "order": 6,
      "props": {
        "quote": "Type high is 0.918 inches. Everything else is taste.",
        "attribution": "Tomás",
        "blockGround": "c"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-thanks",
      "type": "thank-you",
      "variant": "text+media",
      "order": 7,
      "props": {
        "message": "Every print that leaves Leeds is numbered by hand. Thank you."
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [
          "5eed0007-0000-4000-8000-000000000043"
        ],
        "productIds": [],
        "voiceoverIds": []
      }
    },
    {
      "id": "w4-cta",
      "type": "contact-cta",
      "variant": "card",
      "order": 8,
      "props": {
        "label": "Plan a commission",
        "blockGround": "b"
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    }
  ],
  "meta": {
    "version": 1,
    "status": "published",
    "criticScore": 0.9,
    "approvedSections": [
      "w4-hero",
      "w4-divide",
      "w4-story",
      "w4-reel",
      "w4-shop",
      "w4-detail",
      "w4-quote",
      "w4-thanks",
      "w4-cta"
    ],
    "createdAt": "2026-07-21T09:00:00Z",
    "updatedAt": "2026-07-22T08:00:00Z"
  }
}$cfg$::jsonb, true)
on conflict (id) do update set
  owner_id = excluded.owner_id, handle = excluded.handle, name = excluded.name,
  craft = excluded.craft, bio = excluded.bio, config = excluded.config, published = excluded.published
where (stores.owner_id, stores.handle, stores.name, stores.craft, stores.bio, stores.config, stores.published)
  is distinct from
  (excluded.owner_id, excluded.handle, excluded.name, excluded.craft, excluded.bio, excluded.config, excluded.published);

insert into public.stores (id, owner_id, handle, name, craft, bio, config, published)
values ('5eed0002-0000-4000-8000-000000000099', '5eed0001-0000-4000-8000-000000000099', 'seed-probe-unpublished', 'Seed Probe (unpublished)', 'internal fixture', 'Unpublished probe store proving anon cannot read published=false rows.',
$cfg${
  "schemaVersion": "1.3",
  "storeId": "5eed0002-0000-4000-8000-000000000099",
  "maker": {
    "id": "5eed0001-0000-4000-8000-000000000099",
    "displayName": "Seed Probe",
    "handle": "seed-probe",
    "craft": "internal fixture",
    "location": "n/a",
    "bio": "Internal unpublished RLS probe. Not a real maker; never published.",
    "avatarMediaId": null,
    "trust": {
      "realMaker": {
        "status": "unverified",
        "verifiedAt": null,
        "voiceAnchorClipId": null
      },
      "aiTransparency": {
        "level": "maker-authored",
        "disclosure": "Internal fixture.",
        "aiAssistedFields": []
      }
    }
  },
  "theme": {
    "kind": "curated",
    "paletteId": "sunbaked",
    "mode": "light",
    "fontPairingId": "statement-grotesk",
    "motionPreset": "hushed",
    "radiusIdentity": "sharp",
    "density": "standard"
  },
  "media": {
    "clips": [],
    "images": []
  },
  "products": [],
  "voiceovers": [],
  "blocks": [
    {
      "id": "probe-hero",
      "type": "hero-video",
      "variant": "full-bleed",
      "order": 0,
      "props": {
        "showCraftLine": false
      },
      "bindings": {
        "clipTags": [],
        "imageIds": [],
        "productIds": [],
        "voiceoverIds": []
      }
    }
  ],
  "meta": {
    "version": 0,
    "status": "draft",
    "criticScore": 0.8,
    "approvedSections": [],
    "createdAt": "2026-07-22T08:00:00Z",
    "updatedAt": "2026-07-22T08:00:00Z"
  }
}$cfg$::jsonb, false)
on conflict (id) do update set
  owner_id = excluded.owner_id, handle = excluded.handle, name = excluded.name,
  craft = excluded.craft, bio = excluded.bio, config = excluded.config, published = excluded.published
where (stores.owner_id, stores.handle, stores.name, stores.craft, stores.bio, stores.config, stores.published)
  is distinct from
  (excluded.owner_id, excluded.handle, excluded.name, excluded.craft, excluded.bio, excluded.config, excluded.published);

-- --- 4 · media (config-referenced images; kind 'image') ----------------------
insert into public.media (id, owner_id, store_id, kind, src, alt, aspect, focal_point)
values
  ('5eed0007-0000-4000-8000-000000000011', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', 'image', '/seed/hollowgrain/portrait.svg', 'Wren Hollis at the lathe', '4:5', '{"x":0.5,"y":0.35}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000012', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', 'image', '/seed/hollowgrain/storm-oak-bowl.svg', 'Storm Oak Bowl, oiled finish', '1:1', '{"x":0.5,"y":0.55}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000013', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', 'image', '/seed/hollowgrain/spalted-vessel.svg', 'Spalted Beech Vessel, ink-line figuring', '4:5', '{"x":0.5,"y":0.5}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000014', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', 'image', '/seed/hollowgrain/walnut-boards.svg', 'Pair of walnut serving boards', '3:2', '{"x":0.5,"y":0.5}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000021', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', 'image', '/seed/isoldeglass/portrait.svg', 'Isolde Brandt at the furnace door', '4:5', '{"x":0.46,"y":0.34}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000022', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', 'image', '/seed/isoldeglass/sea-smoke-tumblers.svg', 'Sea Smoke Tumblers, set of four', '1:1', '{"x":0.5,"y":0.5}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000023', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', 'image', '/seed/isoldeglass/amber-swell-vase.svg', 'Amber Swell Vase, lit from behind', '4:5', '{"x":0.5,"y":0.48}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000024', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', 'image', '/seed/isoldeglass/tide-line-carafe.svg', 'Tide Line Carafe with two glasses', '3:2', '{"x":0.44,"y":0.5}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000031', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', 'image', '/seed/maraleather/portrait.svg', 'Mara Okafor at the stitching pony', '4:5', '{"x":0.5,"y":0.33}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000032', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', 'image', '/seed/maraleather/ninefold-belt.svg', 'Ninefold Belt coiled on the bench', '3:2', '{"x":0.5,"y":0.5}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000033', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', 'image', '/seed/maraleather/oxblood-sleeve.svg', 'Card Sleeve in oxblood bridle leather', '1:1', '{"x":0.5,"y":0.5}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000034', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', 'image', '/seed/maraleather/weekend-holdall.svg', 'Weekend Holdall, one hide, brass hardware', '4:5', '{"x":0.5,"y":0.45}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000041', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', 'image', '/seed/ferreirapress/portrait.svg', 'Tomás Ferreira pulling a proof on the Vandercook', '4:5', '{"x":0.48,"y":0.32}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000042', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', 'image', '/seed/ferreirapress/broadside-12.svg', 'Broadside No. 12, vermilion and black on cream', '4:5', '{"x":0.5,"y":0.42}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000043', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', 'image', '/seed/ferreirapress/caslon-notebook.svg', 'Hand-bound notebook, Caslon edition', '1:1', '{"x":0.5,"y":0.5}'::jsonb),
  ('5eed0007-0000-4000-8000-000000000044', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', 'image', '/seed/ferreirapress/press-room.svg', 'The press room: type cases and the Vandercook', '3:2', '{"x":0.42,"y":0.5}'::jsonb)
on conflict (id) do update set
  owner_id = excluded.owner_id, store_id = excluded.store_id, kind = excluded.kind,
  src = excluded.src, alt = excluded.alt, aspect = excluded.aspect, focal_point = excluded.focal_point
where (media.owner_id, media.store_id, media.kind, media.src, media.alt, media.aspect, media.focal_point)
  is distinct from
  (excluded.owner_id, excluded.store_id, excluded.kind, excluded.src, excluded.alt, excluded.aspect, excluded.focal_point);

-- --- 5 · videos (canonical clips — config media.clips[].id equals these ids, OQ-2)
insert into public.videos (id, owner_id, store_id, src, poster, duration_ms, captions_src)
values
  ('5eed0003-0000-4000-8000-000000000011', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', '/seed/hollowgrain/intro.mp4', '/seed/hollowgrain/intro-poster.svg', 9000, null),
  ('5eed0003-0000-4000-8000-000000000012', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', '/seed/hollowgrain/story.mp4', '/seed/hollowgrain/story-poster.svg', 14000, null),
  ('5eed0003-0000-4000-8000-000000000013', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', '/seed/hollowgrain/process.mp4', '/seed/hollowgrain/process-poster.svg', 18000, null),
  ('5eed0003-0000-4000-8000-000000000014', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', '/seed/hollowgrain/narration.mp4', '/seed/hollowgrain/narration-poster.svg', 11000, null),
  ('5eed0003-0000-4000-8000-000000000015', '5eed0001-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', '/seed/hollowgrain/thanks.mp4', '/seed/hollowgrain/thanks-poster.svg', 7000, null),
  ('5eed0003-0000-4000-8000-000000000021', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', '/seed/isoldeglass/intro.mp4', '/seed/isoldeglass/intro-poster.svg', 8000, null),
  ('5eed0003-0000-4000-8000-000000000022', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', '/seed/isoldeglass/story.mp4', '/seed/isoldeglass/story-poster.svg', 13000, null),
  ('5eed0003-0000-4000-8000-000000000023', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', '/seed/isoldeglass/process.mp4', '/seed/isoldeglass/process-poster.svg', 16000, null),
  ('5eed0003-0000-4000-8000-000000000024', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', '/seed/isoldeglass/narration.mp4', '/seed/isoldeglass/narration-poster.svg', 12000, null),
  ('5eed0003-0000-4000-8000-000000000025', '5eed0001-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', '/seed/isoldeglass/thanks.mp4', '/seed/isoldeglass/thanks-poster.svg', 6000, null),
  ('5eed0003-0000-4000-8000-000000000031', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', '/seed/maraleather/intro.mp4', '/seed/maraleather/intro-poster.svg', 10000, null),
  ('5eed0003-0000-4000-8000-000000000032', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', '/seed/maraleather/story.mp4', '/seed/maraleather/story-poster.svg', 15000, null),
  ('5eed0003-0000-4000-8000-000000000033', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', '/seed/maraleather/process.mp4', '/seed/maraleather/process-poster.svg', 17000, null),
  ('5eed0003-0000-4000-8000-000000000034', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', '/seed/maraleather/narration.mp4', '/seed/maraleather/narration-poster.svg', 9000, null),
  ('5eed0003-0000-4000-8000-000000000035', '5eed0001-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000003', '/seed/maraleather/thanks.mp4', '/seed/maraleather/thanks-poster.svg', 7000, null),
  ('5eed0003-0000-4000-8000-000000000041', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', '/seed/ferreirapress/intro.mp4', '/seed/ferreirapress/intro-poster.svg', 9000, null),
  ('5eed0003-0000-4000-8000-000000000042', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', '/seed/ferreirapress/story.mp4', '/seed/ferreirapress/story-poster.svg', 12000, null),
  ('5eed0003-0000-4000-8000-000000000043', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', '/seed/ferreirapress/process.mp4', '/seed/ferreirapress/process-poster.svg', 19000, null),
  ('5eed0003-0000-4000-8000-000000000044', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', '/seed/ferreirapress/narration.mp4', '/seed/ferreirapress/narration-poster.svg', 10000, null),
  ('5eed0003-0000-4000-8000-000000000045', '5eed0001-0000-4000-8000-000000000004', '5eed0002-0000-4000-8000-000000000004', '/seed/ferreirapress/thanks.mp4', '/seed/ferreirapress/thanks-poster.svg', 8000, null)
on conflict (id) do update set
  owner_id = excluded.owner_id, store_id = excluded.store_id, src = excluded.src,
  poster = excluded.poster, duration_ms = excluded.duration_ms, captions_src = excluded.captions_src
where (videos.owner_id, videos.store_id, videos.src, videos.poster, videos.duration_ms, videos.captions_src)
  is distinct from
  (excluded.owner_id, excluded.store_id, excluded.src, excluded.poster, excluded.duration_ms, excluded.captions_src);

-- --- 6 · video_profiles (frozen vocabulary; MIG-CHECK constraints enforce it)
insert into public.video_profiles (id, video_id, purpose, page_eligibility, product_links, mood, anti_repetition_key)
values
  ('5eed0004-0000-4000-8000-000000000011', '5eed0003-0000-4000-8000-000000000011', array['intro']::text[], array['feed','grown','world']::text[], array[]::uuid[], array['warm','calm']::text[], 'hollowgrain-intro'),
  ('5eed0004-0000-4000-8000-000000000012', '5eed0003-0000-4000-8000-000000000012', array['craft-story']::text[], array['grown','world']::text[], array[]::uuid[], array['intimate']::text[], 'hollowgrain-story'),
  ('5eed0004-0000-4000-8000-000000000013', '5eed0003-0000-4000-8000-000000000013', array['process']::text[], array['world']::text[], array[]::uuid[], array['calm']::text[], 'hollowgrain-lathe'),
  ('5eed0004-0000-4000-8000-000000000014', '5eed0003-0000-4000-8000-000000000014', array['product-narration']::text[], array['product']::text[], array['5eed0005-0000-4000-8000-000000000011']::uuid[], array['intimate','calm']::text[], 'hollowgrain-storm-oak-bowl'),
  ('5eed0004-0000-4000-8000-000000000015', '5eed0003-0000-4000-8000-000000000015', array['thankyou']::text[], array['thankyou']::text[], array[]::uuid[], array['warm']::text[], 'hollowgrain-thanks'),
  ('5eed0004-0000-4000-8000-000000000021', '5eed0003-0000-4000-8000-000000000021', array['intro']::text[], array['feed','grown','world']::text[], array[]::uuid[], array['warm','energetic']::text[], 'isoldeglass-intro'),
  ('5eed0004-0000-4000-8000-000000000022', '5eed0003-0000-4000-8000-000000000022', array['craft-story']::text[], array['grown','world']::text[], array[]::uuid[], array['intimate']::text[], 'isoldeglass-story'),
  ('5eed0004-0000-4000-8000-000000000023', '5eed0003-0000-4000-8000-000000000023', array['process']::text[], array['world']::text[], array[]::uuid[], array['energetic']::text[], 'isoldeglass-furnace'),
  ('5eed0004-0000-4000-8000-000000000024', '5eed0003-0000-4000-8000-000000000024', array['product-narration']::text[], array['product']::text[], array['5eed0005-0000-4000-8000-000000000021']::uuid[], array['calm']::text[], 'isoldeglass-sea-smoke'),
  ('5eed0004-0000-4000-8000-000000000025', '5eed0003-0000-4000-8000-000000000025', array['thankyou']::text[], array['thankyou']::text[], array[]::uuid[], array['warm','intimate']::text[], 'isoldeglass-thanks'),
  ('5eed0004-0000-4000-8000-000000000031', '5eed0003-0000-4000-8000-000000000031', array['intro']::text[], array['feed','grown','world']::text[], array[]::uuid[], array['calm']::text[], 'maraleather-intro'),
  ('5eed0004-0000-4000-8000-000000000032', '5eed0003-0000-4000-8000-000000000032', array['craft-story']::text[], array['grown','world']::text[], array[]::uuid[], array['intimate','calm']::text[], 'maraleather-story'),
  ('5eed0004-0000-4000-8000-000000000033', '5eed0003-0000-4000-8000-000000000033', array['process']::text[], array['world']::text[], array[]::uuid[], array['calm']::text[], 'maraleather-stitch'),
  ('5eed0004-0000-4000-8000-000000000034', '5eed0003-0000-4000-8000-000000000034', array['product-narration']::text[], array['product']::text[], array['5eed0005-0000-4000-8000-000000000031']::uuid[], array['intimate']::text[], 'maraleather-ninefold'),
  ('5eed0004-0000-4000-8000-000000000035', '5eed0003-0000-4000-8000-000000000035', array['thankyou']::text[], array['thankyou']::text[], array[]::uuid[], array['warm']::text[], 'maraleather-thanks'),
  ('5eed0004-0000-4000-8000-000000000041', '5eed0003-0000-4000-8000-000000000041', array['intro']::text[], array['feed','grown','world']::text[], array[]::uuid[], array['warm']::text[], 'ferreirapress-intro'),
  ('5eed0004-0000-4000-8000-000000000042', '5eed0003-0000-4000-8000-000000000042', array['craft-story']::text[], array['grown','world']::text[], array[]::uuid[], array['calm']::text[], 'ferreirapress-story'),
  ('5eed0004-0000-4000-8000-000000000043', '5eed0003-0000-4000-8000-000000000043', array['process']::text[], array['world']::text[], array[]::uuid[], array['energetic']::text[], 'ferreirapress-vandercook'),
  ('5eed0004-0000-4000-8000-000000000044', '5eed0003-0000-4000-8000-000000000044', array['product-narration']::text[], array['product']::text[], array['5eed0005-0000-4000-8000-000000000041']::uuid[], array['intimate']::text[], 'ferreirapress-broadside'),
  ('5eed0004-0000-4000-8000-000000000045', '5eed0003-0000-4000-8000-000000000045', array['thankyou']::text[], array['thankyou']::text[], array[]::uuid[], array['warm']::text[], 'ferreirapress-thanks')
on conflict (id) do update set
  video_id = excluded.video_id, purpose = excluded.purpose,
  page_eligibility = excluded.page_eligibility, product_links = excluded.product_links,
  mood = excluded.mood, anti_repetition_key = excluded.anti_repetition_key
where (video_profiles.video_id, video_profiles.purpose, video_profiles.page_eligibility, video_profiles.product_links, video_profiles.mood, video_profiles.anti_repetition_key)
  is distinct from
  (excluded.video_id, excluded.purpose, excluded.page_eligibility, excluded.product_links, excluded.mood, excluded.anti_repetition_key);

-- --- 7 · products (integer MINOR units, GBP; at least one sold-out for B6) ---
insert into public.products (id, store_id, title, description, materials, price_amount, currency, inventory_status, inventory_qty, model3d_id, badges)
values
  ('5eed0005-0000-4000-8000-000000000011', '5eed0002-0000-4000-8000-000000000001', 'Storm Oak Bowl', 'Turned from a single oak blank brought down in the January storms. Open grain, oiled to a soft sheen — the split the storm started is stitched with a bronze butterfly.', 'storm-felled English oak, food-safe hard-wax oil, bronze', 14500, 'GBP', 'in-stock', 1, null, array['one-of-a-kind']::text[]),
  ('5eed0005-0000-4000-8000-000000000012', '5eed0002-0000-4000-8000-000000000001', 'Spalted Beech Vessel', 'A tall closed form in spalted beech — the black ink-lines are the tree''s own weather diary. Sold, but a commission can chase the same figure.', 'spalted beech, matte lacquer', 21000, 'GBP', 'sold-out', 0, null, array['one-of-a-kind']::text[]),
  ('5eed0005-0000-4000-8000-000000000013', '5eed0002-0000-4000-8000-000000000001', 'Walnut Serving Boards, pair', 'Two long boards from the same walnut plank, so the grain runs across the pair when they sit together. Made to order, oiled and waxed.', 'English walnut, hard-wax oil, beeswax', 8500, 'GBP', 'made-to-order', null, null, array['made-to-order']::text[]),
  ('5eed0005-0000-4000-8000-000000000021', '5eed0002-0000-4000-8000-000000000002', 'Sea Smoke Tumblers, set of four', 'Four tumblers in fog grey with a drifting white veil trapped in the wall. Blown in one session so the set breathes together.', 'soda-lime glass, white enamel veil', 12000, 'GBP', 'in-stock', 8, null, array['limited']::text[]),
  ('5eed0005-0000-4000-8000-000000000022', '5eed0002-0000-4000-8000-000000000002', 'Amber Swell Vase', 'One gather, one breath, one wave of amber caught mid-swell. The lean is deliberate — the glass wanted it.', 'soda-lime glass, amber oxide', 34000, 'GBP', 'in-stock', 1, null, array['one-of-a-kind']::text[]),
  ('5eed0005-0000-4000-8000-000000000023', '5eed0002-0000-4000-8000-000000000002', 'Tide Line Carafe', 'A litre carafe with a green tide line rolled into the shoulder. Made to order, each line lands where the day''s tide left it.', 'soda-lime glass, copper-green trail', 19000, 'GBP', 'made-to-order', null, null, array['made-to-order']::text[]),
  ('5eed0005-0000-4000-8000-000000000031', '5eed0002-0000-4000-8000-000000000003', 'Ninefold Belt', 'One strap of English bridle leather, nine stitches to the inch where the buckle turns. Made to your waist, not a size chart.', 'English bridle leather, solid brass, linen thread', 9500, 'GBP', 'made-to-order', null, null, array['made-to-order']::text[]),
  ('5eed0005-0000-4000-8000-000000000032', '5eed0002-0000-4000-8000-000000000003', 'Card Sleeve in Oxblood', 'Four cards, folded notes, nothing else. One piece of leather, one line of saddle stitch, edges burnished until they shine.', 'oxblood bridle leather, linen thread', 4800, 'GBP', 'in-stock', 14, null, array[]::text[]),
  ('5eed0005-0000-4000-8000-000000000033', '5eed0002-0000-4000-8000-000000000003', 'Weekend Holdall', 'Cut from a single hide so the grain runs unbroken around the body. Brass feet, saddle-stitched handles, a lifetime guarantee measured in decades. Sold.', 'full English bridle hide, solid brass, linen thread', 52000, 'GBP', 'sold-out', 0, null, array['one-of-a-kind']::text[]),
  ('5eed0005-0000-4000-8000-000000000041', '5eed0002-0000-4000-8000-000000000004', 'Broadside No. 12 — The Sea Gives Back', 'A two-colour broadside set in 36 pt Caslon, printed in three passes on 300 gsm cotton rag. Edition of 40, numbered and signed in pencil.', 'cotton rag paper, oil-based ink', 6500, 'GBP', 'in-stock', 24, null, array['limited']::text[]),
  ('5eed0005-0000-4000-8000-000000000042', '5eed0002-0000-4000-8000-000000000004', 'Hand-bound Notebook, Caslon Edition', '96 pages of Munken laid stock, section-sewn, with a letterpress cover set in Caslon ornaments. Lies flat from page one.', 'Munken paper, linen thread, letterpress cover', 4200, 'GBP', 'in-stock', 11, null, array[]::text[]),
  ('5eed0005-0000-4000-8000-000000000043', '5eed0002-0000-4000-8000-000000000004', 'Wedding Suite, hand-set (per 50)', 'Invitations, RSVPs and details cards, hand-set in Caslon and printed on the Vandercook. Priced per fifty; every suite starts with a proofing visit or video call.', 'cotton rag paper, oil-based ink', 28000, 'GBP', 'made-to-order', null, null, array['made-to-order']::text[])
on conflict (id) do update set
  store_id = excluded.store_id, title = excluded.title, description = excluded.description,
  materials = excluded.materials, price_amount = excluded.price_amount, currency = excluded.currency,
  inventory_status = excluded.inventory_status, inventory_qty = excluded.inventory_qty,
  model3d_id = excluded.model3d_id, badges = excluded.badges
where (products.store_id, products.title, products.description, products.materials, products.price_amount, products.currency, products.inventory_status, products.inventory_qty, products.model3d_id, products.badges)
  is distinct from
  (excluded.store_id, excluded.title, excluded.description, excluded.materials, excluded.price_amount, excluded.currency, excluded.inventory_status, excluded.inventory_qty, excluded.model3d_id, excluded.badges);

-- --- 8 · product_specs (P14 standard — every content column populated) -------
insert into public.product_specs (id, product_id, dimensions, materials, texture, handmade_variation, production_time, shipping, care, repairs, returns, customization_limits)
values
  ('5eed0006-0000-4000-8000-000000000011', '5eed0005-0000-4000-8000-000000000011', '28 cm diameter × 11 cm high, walls 6 mm', 'Storm-felled English oak; bronze butterfly key; food-safe hard-wax oil', 'Open oak grain under a satin oil finish; gouge facets left visible inside the foot', 'The storm split and its bronze stitch are unique to this blank — no two bowls share them', 'Finished and ready to ship in 2–3 working days', 'Tracked UK courier, 2–3 days; worldwide on request. Packed in recycled wood wool', 'Hand wash, dry immediately, re-oil twice a year with any food-safe oil', 'Free re-oiling for life; cracks and chips assessed and repaired at cost', '14-day returns, unused; one-of-a-kind pieces refunded on arrival back at the workshop', 'This piece is finished — no alterations. Commission a turning for custom sizes'),
  ('5eed0006-0000-4000-8000-000000000012', '5eed0005-0000-4000-8000-000000000012', '17 cm diameter × 26 cm high', 'Spalted beech from a single Kent hedgerow tree; water-based matte lacquer', 'Glass-smooth exterior; the spalting reads as ink lines under the finish', 'Spalting is fungal weather-writing — the pattern cannot be repeated, only echoed', 'Sold out. A commissioned echo takes 4–6 weeks', 'Tracked UK courier, insured; worldwide on request', 'Dry display only — spalted wood dislikes standing water', 'Lifetime refinishing at cost', '14-day returns, unused', 'Form can be commissioned in other spalted blanks; the exact figure cannot be reproduced'),
  ('5eed0006-0000-4000-8000-000000000013', '5eed0005-0000-4000-8000-000000000013', '45 × 18 × 2 cm each, sold as a bookmatched pair', 'English walnut from one plank; hard-wax oil; beeswax top coat', 'Silky planed face, chamfered edges, saw-kissed underside', 'Each pair is cut from a different plank — colour runs chocolate to honey', 'Made to order in 2 weeks', 'Tracked UK courier, 2–3 days after making', 'Hand wash, dry flat, re-wax monthly with the enclosed block', 'Resurfacing service at cost, postage both ways on us in year one', 'Made-to-order: returns accepted for faults; changes of mind within 48 h of ordering', 'Length and chamfer to spec within 30–60 cm; no engraving'),
  ('5eed0006-0000-4000-8000-000000000021', '5eed0005-0000-4000-8000-000000000021', '9 cm high × 8 cm diameter, ~300 ml each', 'Soda-lime glass; white enamel veil worked into the gather', 'Fire-polished rim; faint pontil scar on the base, ground smooth', 'The veil drifts differently through each tumbler — sets rhyme, never match', 'In stock — ships in 2 working days', 'Double-boxed, tracked UK courier; EU and US on request', 'Dishwasher safe on glass cycle; avoid thermal shock', 'Chipped rims reground free within the first year', '30-day returns, unused, in the original box', 'Sets of 6 or 8 by request; colour fixed to the sea-smoke palette'),
  ('5eed0006-0000-4000-8000-000000000022', '5eed0005-0000-4000-8000-000000000022', '31 cm high × 15 cm at the widest swell', 'Soda-lime glass with amber oxide; solid punted base', 'Glass-bright surface; the swell carries faint tool lines like tide marks', 'Blown in one breath — the lean and the swell are this piece alone', 'Ships in 2 working days', 'Crated, insured, tracked; worldwide', 'Wipe clean; keep off sunny sills in hard frost', 'Assessment free; grinding and polishing at cost', '14-day returns on arrival-condition pieces', 'One of a kind — commissions in the same palette take 6 weeks'),
  ('5eed0006-0000-4000-8000-000000000023', '5eed0005-0000-4000-8000-000000000023', '26 cm high, 1 litre to the shoulder', 'Soda-lime glass; copper-green glass trail', 'Smooth body with a raised tide-line trail you can find in the dark', 'The trail''s height and drift follow the session — no two carafes share a tide', 'Made to order, 3–4 weeks', 'Double-boxed, tracked UK courier; worldwide on request', 'Hand wash; no boiling water straight from the kettle', 'Regrinding and polishing at cost', 'Made-to-order: faults always; otherwise 48 h cancellation window', 'Volume 0.5–1.5 l; trail colour green or amber only'),
  ('5eed0006-0000-4000-8000-000000000031', '5eed0005-0000-4000-8000-000000000031', '38 mm wide, cut to your measurement; ~4 mm thick', 'English bridle leather; solid brass buckle; hand-waxed linen thread', 'Firm, waxy hand that burnishes to glass at the edges with wear', 'Hide grain and burnish deepen differently on every strap', 'Made to measure in 10 working days', 'Royal Mail tracked, 1–2 days after making', 'Wipe dry; feed with leather balm twice a year', 'Free restitching for life; buckles replaced at cost', 'Made to measure: faults always; sizing remakes free once', 'Width 30–40 mm; brass or nickel; no embossing'),
  ('5eed0006-0000-4000-8000-000000000032', '5eed0005-0000-4000-8000-000000000032', '10.5 × 7.5 cm, 5 mm thin', 'Oxblood English bridle leather; linen thread; beeswax edge finish', 'Smooth grain face, waxed edges, softens and moulds to the cards', 'Oxblood shade varies hide to hide, russet through black-cherry', 'In stock — ships next working day', 'Royal Mail tracked letter', 'Nothing required; balm once a year if it lives in salt air', 'Restitched free, forever', '30-day returns, unused', 'Monogram stamp (3 letters) at checkout; colour as pictured'),
  ('5eed0006-0000-4000-8000-000000000033', '5eed0005-0000-4000-8000-000000000033', '52 × 28 × 26 cm; 2.1 kg empty', 'One full English bridle hide; solid brass zip and feet; linen thread throughout', 'Firm structured body that relaxes into its own shape over the first year', 'Single-hide cutting means the scar map and grain run are unrepeatable', 'Sold. The next hide goes on the bench in September — join the list', 'Insured courier, signature on delivery', 'Balm twice a year; stuff with paper when stored', 'Restitching free for life; hardware at cost; refurbishment service at year ten', '14-day returns, unused', 'Commission slots allow strap and lining choices; body shape is fixed'),
  ('5eed0006-0000-4000-8000-000000000041', '5eed0005-0000-4000-8000-000000000041', '35 × 50 cm, unframed', '300 gsm cotton rag; oil-based letterpress inks, vermilion and black', 'Deep impression you can read with a fingertip; deckled left edge', 'Ink coverage breathes across the edition — later numbers run slightly drier', 'In stock — ships flat in 2 working days', 'Board-backed envelope or tube, tracked; worldwide', 'Frame behind UV glass; keep off damp walls', 'Not applicable — replacements from the edition while numbers last', '30-day returns in original packing', 'Edition is fixed; no reprints once the 40 are gone'),
  ('5eed0006-0000-4000-8000-000000000042', '5eed0005-0000-4000-8000-000000000042', 'A5, 96 pages, 120 gsm', 'Munken Pure laid paper; linen thread; 300 gsm letterpress cover', 'Laid paper tooth that loves pencil; debossed cover ornaments', 'Cover ornament arrangement is reset every binding session', 'In stock — ships next working day', 'Royal Mail tracked', 'None. Fill it', 'Rebinding service at cost when you wear it out', '30-day returns, unused', 'Plain pages only; no lined or dotted variants'),
  ('5eed0006-0000-4000-8000-000000000043', '5eed0005-0000-4000-8000-000000000043', 'A6 invitation, A7 RSVP, A7 details card, per 50 of each', '300 gsm cotton rag; oil-based inks mixed to your palette', 'Deep letterpress impression on soft cotton stock', 'Hand-set type carries tiny inking differences card to card — that is the medium', '4–6 weeks from approved proof', 'Boxed, tracked courier; hand collection from the press welcome', 'Store flat and dry until the post office takes over', 'Misprints replaced from the make-ready allowance', 'Bespoke: the approved proof is the contract; faults reprinted free', 'Two ink colours; typefaces limited to the cases I hold (Caslon, Gill, Univers)')
on conflict (id) do update set
  product_id = excluded.product_id, dimensions = excluded.dimensions, materials = excluded.materials, texture = excluded.texture, handmade_variation = excluded.handmade_variation, production_time = excluded.production_time, shipping = excluded.shipping, care = excluded.care, repairs = excluded.repairs, returns = excluded.returns, customization_limits = excluded.customization_limits
where (product_specs.dimensions, product_specs.materials, product_specs.texture, product_specs.handmade_variation, product_specs.production_time, product_specs.shipping, product_specs.care, product_specs.repairs, product_specs.returns, product_specs.customization_limits)
  is distinct from
  (excluded.dimensions, excluded.materials, excluded.texture, excluded.handmade_variation, excluded.production_time, excluded.shipping, excluded.care, excluded.repairs, excluded.returns, excluded.customization_limits);

commit;
