# Changelog

All notable changes to this repo — the KOL product and the agent kit that builds it.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## KOL — 2026-07-22 · first public deployment

### Added
- **KOL is live at [etsyc.vercel.app](https://etsyc.vercel.app)** on its own Supabase project — 16 migrations, seeded worlds, deployed from `deploy/canonical`
- Real landing page (brand hero + live maker index, ISR), replacing the /preview stub
- Branded 404, favicon, theme-color, Open Graph tags + generated share cards (site-wide and per-world)
- robots.txt, dynamic sitemap.xml, JSON-LD (WebSite + per-world Person), baseline security headers
- "← KOL" chrome on deep-linked worlds; focus-visible on all new interactive elements

### Fixed
- Seed data mojibake repaired in-place in the live DB (clipboard-transport corruption; see DECISIONS.md)
- Feed empty-state copy now honest for anti-repetition ring exhaustion ("You're all caught up")
- Seller dashboard no longer leaks internal sprint jargon

---

## [1.0.0] — 2026-02-28

### Added
- 12-agent autonomous startup team (Iris, Atlas, Sage, Guardian, Nexus, Scout, Spark, Axiom, Morgan, Nova, Rex, Lyra)
- GSA workflow: 28 slash commands (`/gsa:new-project`, `/gsa:plan-phase`, `/gsa:execute-phase`, etc.)
- `bin/install.js` — NPX CLI installer with `--claude`, `--cursor`, `--antigravity` flags
- 5 top-level commands: `/daily`, `/plan`, `/ship`, `/audit`, `/research`
- `.cursor/rules/` — Cursor integration
- 426+ skills via `antigravity-awesome-skills` (installed separately)
- GSA internals: templates, references, workflows, hooks
- Memory system: `DECISIONS.md`, `CODEBASE-MAP.md`, `USER-INSIGHTS.md`

---

## [1.1.0] — 2026-03-09

### Changed
- Agent system upgraded from 12-agent flat team to 3-layer CEO → Team Leads → Workers architecture
- CEO replaces Iris as entry point for all tasks
- 9 named Team Leads replace individual named agents (iris→ceo, atlas→build-lead, etc.)
- 9 Worker agents + 12 GSD execution agents replace old gsa-* execution agents
- Slash commands expanded: added `/build`, `/fix`, `/design`, `/review`
- README, QUICK_REFERENCE, GETTING_STARTED updated to reflect new architecture
- package.json version bumped to 1.1.0, repository URL fixed, Cursor removed from keywords

### Removed
- `.cursor/rules/` folder — Cursor integration removed; Claude Code + Antigravity are primary tools
- `.vscode/settings.json` — not needed for public kit
- `all_skills_stored/` excluded via .gitignore (55MB stale backup; live skills remain at `.agent/skills/`)

### Fixed
- package.json repository URL (was `YOUR_ORG` placeholder, now points to correct repo)
- Old agent name references (Iris, Atlas, Morgan, etc.) across all public docs

---

*Older entries will be added as the kit evolves.*
