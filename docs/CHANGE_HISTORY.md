# Change history & incident log

Read this file at the start of agent sessions before changing dev tooling, persistence, or CSS/PostCSS.

## Stable baseline (2026-06-03, evening)

Known-good working copy on Windows with dual Node (22 + 24):

- `npm install` — auto-relays to Node 22 via `preinstall`
- `npm run dev:stack` — force-rebuilds `better-sqlite3`, starts Solr + Next on Node 22
- Templates / connections persist via SQLite; **102 tests** pass (`npm run test`)
- Compare **Export report** supports **Technical** (default) and **Business** (Gemini) PDF audiences
- Tailwind compiles via `postcss.config.mjs` absolute vendor injection

## Environment constraints (Windows)

- **Node 22 only** (`.nvmrc`, `engines: >=22 <23`). Two installs often coexist:
  - Cursor bundled: `…\cursor\…\helpers\node.exe` → v22
  - Program Files: `C:\Program Files\nodejs\node.exe` → v24
- **`npm install` on Node 24**: `preinstall` **relays** to `scripts/run-npm.mjs` (Node 22). Plain `npm install` works.
  - Or: `npm run setup` / `npm run install:deps`
  - **Do not** use plain `npm rebuild` on Node 24 — use `npm run rebuild:native`. Dev (`dev:stack`) force-rebuilds sqlite on start.
- **`better-sqlite3`**: `npm run rebuild:native` or restart `npm run dev:stack`.

## Stray parent lockfile (critical)

- `C:\Users\PC\package-lock.json` makes Next/Turbopack/PostCSS treat `C:\Users\PC` as workspace root.
- **Symptom**: `Can't resolve 'tailwindcss' in 'C:\Users\PC\Projects'`.
- **Fixes in repo**:
  - `next.config.ts`: `turbopack.root`, `outputFileTracingRoot`, `resolveAlias`
  - `postcss.config.mjs`: inline vendor CSS via absolute paths + `SOLR_PLAYGROUND_ROOT` env from dev scripts
  - **Long-term**: remove/rename the parent `C:\Users\PC\package-lock.json` if unused.

## `.env.local` / Gemini AI

- Next only reads **saved** files. Unsaved editor buffer ≠ disk.
- **Symptom**: `Evaluate relevance (AI)` disabled; `GET /api/compare/evaluate` → `available: false`.
- **Fix**: Save `.env.local` with `GEMINI_API_KEY=…`, restart dev.

## Agent mistakes (do not repeat)

1. **Assumed `turbopack.root` alone fixes CSS** — PostCSS still resolved from `C:\Users\PC\Projects` when a parent lockfile exists. Needed absolute-path vendor injection in `postcss.config.mjs`.
2. **Assumed `require('better-sqlite3')` preflight was enough** — must open `new Database(':memory:')` to detect ABI mismatch reliably.
3. **Added `engine-strict=true` before install relay** — blocked `npm install` entirely on Node 24 before `preinstall` could relay. Removed strict; relay handles it.
4. **Blocked `npm rebuild` in `preinstall`** — then users ran plain `npm rebuild` on Node 24 anyway, breaking templates. Fix: `dev:stack` force-rebuilds; document `npm run rebuild:native` only.
5. **Told user to `npm rebuild better-sqlite3`** in error messages — wrong on dual-Node Windows. Messages now say `rebuild:native` / `dev:stack`.
6. **Trusted editor buffer for `.env.local`** — disk had empty `GEMINI_API_KEY=` while IDE showed a key. Always verify on-disk file.
7. **Used `spawnSync(..., { shell: true })` with arg arrays** — caused `DEP0190` on Node 22+. Use full paths (`where.exe`, `npm-cli.js`) without shell.
8. **Ran verification dev servers without cleaning up** — left port 3000 busy; use `stop:stack` or document restarts clearly.

## Session log (newest first)

### 2026-06-03 — Business-audience PDF export + report polish

- **Feature**: Compare **Export report** now has a **Technical / Business** audience selector beside the green export button. Technical keeps the existing flow (no Gemini). Business calls `POST /api/compare/translate-report` server-side, attaches a `BusinessReportNarrative` to the v2 report payload, and renders the same branded PDF layout with executive-friendly copy.
- **Data**: [`report-payload.ts`](src/lib/compare/report-payload.ts) bumped to `version: 2` with `audience` + `business`; v1 payloads migrate to `audience: "technical"`. Business filename prefix: `compare-report-business-{date}.pdf`.
- **AI layer**: [`report-translator.ts`](src/lib/ai/compare/report-translator.ts) — Gemini JSON narrative, compact input (metrics/hints/overlap, slim appendix ids only). [`report-copy.ts`](src/components/compare/report/report-copy.ts) resolves technical vs business section titles and prose in the PDF.
- **PDF UX**: Business introduction cards hide raw `q`/`fq`/`bq` mono boxes; metrics numbers stay from deterministic `metrics`. Business recommendation page uses translated `recommendation` or `aiNotRunMessage`.
- **Pitfall — duplicate strategy names**: Gemini `headline` often equals the template `side.label`; [`source-card.tsx`](src/components/compare/report/source-card.tsx) was rendering both. Fix: omit bold `side.label` when `showTechnicalQueries === false` (business mode only).
- **Pitfall — split export button rejected**: A combined “audience + export” split control was tried and reverted; user preferred separate **Select** + **Export report** (less accidental export risk).
- **Pitfall — cross-tab report handoff**: `sessionStorage` is per-tab; export must use **`localStorage`** so `/compare/report` in a new tab can read the payload, then clear the key after read.
- **Pitfall — `@react-pdf` types**: Use `ReactNode` from `react`, not `@react-pdf/renderer`; avoid `undefined` in style arrays.
- **Tests added**: `report-translator.test.ts`, `translate-report/route.test.ts`, v2 + v1 compat in `report-payload.test.ts` (102 tests total).
- **Lesson**: Keep numeric facts in `metrics` for business PDFs; let Gemini translate prose only. Disable Business export when `GEMINI_API_KEY` is missing (same pattern as AI evaluate).
- **Screenshots**: `capture-screenshots.mjs` compare template seeds must include `filterQueries: []` and `boostQueries: []` in builder state (POST 500 otherwise after fq/bq builder work). AI screenshot step is non-fatal on Gemini timeout.

### 2026-06-03 — PDF export + brand refresh (earlier)

- **Feature**: Multi-page comparison PDF via **Export report** → new tab `/compare/report` → `@react-pdf/renderer`. Branded light theme (Solr green, Inter, cards/chips). Page order: cover → introduction → technical summary → AI summary → appendix.
- **Lesson**: Report payload can exceed `localStorage` limits — `serializeCompareReportPayload` strips appendix snippets when oversized.

### 2026-06-03 — Stable working copy (Node/npm/sqlite hardening)

- **Issue**: Templates 500 after `npm rebuild`; `npm install` EBADENGINE; recurring sqlite ABI drift.
- **Fix**: Install relay (`check-node-version.mjs`, `run-npm.mjs`), dev force-rebuild, stronger `canLoad`, `.cursor/rules/change-history.mdc`, this file.
- **Lesson**: Treat Windows dual-Node as permanent; never rely on a single `npm`/`node` on PATH.

### 2026-06-03 — Templates 500 after `npm rebuild` / `npm install` EBADENGINE

- **Issue**: `npm rebuild` on Node 24 left wrong ABI; dev on Node 22 failed.
- **Fix**: Removed `engine-strict`; preinstall relays install/ci; dev force-rebuilds sqlite.
- **Lesson**: Never tell users plain `npm rebuild`; only `npm run rebuild:native`.

### 2026-06-03 — npm install warnings

- **Issue**: `EBADENGINE`, `DEP0190` deprecation.
- **Fix**: `run-npm.mjs`, no `shell: true`, full path to `where.exe`.

### 2026-06-03 — Tailwind dev compile failure

- **Issue**: PostCSS resolved from wrong directory despite `turbopack.root`.
- **Fix**: PostCSS plugin injects vendor CSS from absolute paths; `SOLR_PLAYGROUND_ROOT`.
- **Lesson**: `turbopack.root` alone does not fix CSS `@import` with a parent lockfile.

### 2026-06-03 — SQLite / templates broken

- **Issue**: `NODE_MODULE_VERSION` mismatch (Node 22 vs 24).
- **Fix**: `resolve-node.mjs`, dev wrappers pin Node 22 + PATH.
- **Lesson**: `dev:stack` must spawn Next with the same Node used to build native modules.

### 2026-06-03 — Regression tests

- Added persistence + presets API tests; CI runs `test:regression` then full suite with `DATABASE_PATH=:memory:`.

---

When you fix a non-obvious bug, append a dated entry here (issue → fix → lesson).
