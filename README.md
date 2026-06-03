# Solr Playground

Sidecar UI for **Apache Solr** — query and analysis only (no data mutations). Stack: Next.js, Tailwind, Shadcn UI, Zustand.

See [`.cursor-master-plan.md`](.cursor-master-plan.md) for the roadmap and change history.

## Preview

Visual sidecar for Solr query and analysis — build searches, inspect schema, switch endpoints and cores.

![Query builder with field matchers and scored results](docs/screenshots/play-query-builder.png)

| Query builder | Classic syntax | Analyze (schema) |
| :---: | :---: | :---: |
| ![Query builder](docs/screenshots/play-query-builder.png) | ![Classic syntax](docs/screenshots/play-classic.png) | ![Schema analyze tab](docs/screenshots/analyze-schema.png) |
| Multi-field matchers, import from Solr URL, scored hits | Raw `q` + parser, live request preview | Field types, flags, dynamic rules |

**Regenerate screenshots** (Playwright; needs Solr + app on :3000):

```bash
npm run dev:stack                    # separate terminal, leave running
npx playwright install chromium      # once, after npm install
npm run screenshots
```

Output goes to [`docs/screenshots/`](docs/screenshots/). Override the app URL with `APP_URL=http://localhost:3000` if needed. See [Scripts](#scripts) for the full command list.

## Prerequisites

- Node.js 20+ (for the app)
- Docker Desktop (or Docker Engine + Compose v2) for the local Solr showcase

## Recommended: Solr + app in one command

From the **repository root** (after `npm install` once):

```bash
npm run dev:stack
```

This runs **Solr in Docker** (detached) on port **8983**, then starts the **Next.js dev server** on **http://localhost:3000**. Leave this terminal open; press **Ctrl+C** to stop Next.js only (Solr keeps running in Docker).

Stop **both** Solr and anything bound to the app port:

```bash
npm run stop:stack
```

That runs `docker compose … down` for the Solr service and runs **`kill-port` on port 3000**, which frees port 3000 even if a stray `next dev` is still running. If something else important is listening on 3000, stop it manually instead.

### Docker not found on Windows (`Der Befehl "docker" ist ...`)

`dev:stack` / `stop:stack` use Node scripts that look for **`docker` on PATH**, run **`where.exe docker`** on Windows, then try common **`docker.exe`** install locations. Detection uses **`docker --version`** (works without a running engine). If it still fails:

1. Install/start **Docker Desktop**.
2. **Restart Cursor** (or open a new terminal) so PATH includes Docker.
3. Or set **`DOCKER_EXE`** to the full path of `docker.exe`, then run `npm run dev:stack` again (PowerShell):

   ```powershell
   $env:DOCKER_EXE = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
   npm run dev:stack
   ```

## Manual two-step workflow

1. **Solr:** `cd solr && docker compose up -d` (see [`solr/README.md`](solr/README.md))
2. **App:** `npm run dev`

Default Solr base URL in the UI: `http://localhost:8983/solr`.

## Solr endpoints (connection)

The header **endpoint** dropdown lists saved Solr base URLs (default: **Local** → `http://localhost:8983/solr`). Use **Manage endpoints…** or the gear icon to add, edit, or remove connections, optional labels, and per-endpoint Basic auth. The last selected **core** is remembered per endpoint. Settings are stored in a **local SQLite database** on the machine running the app (not in the browser). On first load after an upgrade, existing `localStorage` data is migrated once into the database.

### Local database

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `DATABASE_PATH` | `.data/solr-playground.db` (under the repo) | SQLite file path |
| `SOLR_PLAYGROUND_SECRET` | *(dev fallback)* | AES-256-GCM key material for encrypted Basic auth passwords |

Set `SOLR_PLAYGROUND_SECRET` to a long random string in production so endpoint passwords are not encrypted with the built-in dev fallback.

Apply schema manually (also runs automatically when the app opens the DB):

```bash
npm run db:migrate
```

If `db:migrate` or the app fails with `NODE_MODULE_VERSION` / `better_sqlite3.node`, your Node version changed since `npm install`. Rebuild the native module:

```bash
npm rebuild better-sqlite3
```

(`postinstall` runs this automatically after `npm install`.)

The database includes a **sqlite-vec** `embedding_chunks` virtual table (`float[384]`) as a stub for future semantic search; the app does not write embeddings yet.

Schema definitions: [`src/lib/persistence/schema.ts`](src/lib/persistence/schema.ts) and [`src/lib/persistence/migrate-runner.mjs`](src/lib/persistence/migrate-runner.mjs).

#### Browse the DB in Cursor

This repo recommends the **[SQLite Viewer](https://marketplace.visualstudio.com/items?itemName=qwtel.sqlite-viewer)** extension (`qwtel.sqlite-viewer`). Cursor should prompt to install it when you open the workspace (see [`.vscode/extensions.json`](.vscode/extensions.json)).

1. **Extensions** (`Ctrl+Shift+X`) → search **SQLite Viewer** → Install (publisher: Florian Klampfer).
2. Open [`.data/solr-playground.db`](.data/solr-playground.db) (create it first with `npm run dev:stack` or `npm run db:migrate`).
3. Use the table list in the editor to browse `solr_endpoints`, `app_settings`, etc. Run SQL from the viewer when needed.

If the file opens as gibberish text, close it and use the Command Palette (`Ctrl+Shift+P`) → **SQLite Viewer: Open Database** → pick `.data/solr-playground.db`.

![Endpoint and core controls](docs/screenshots/header-connection.png)

## Query templates

On the **Query builder** tab, **Save as template** stores the current parser, field matchers, search text, and edismax options for the active **endpoint** and **core**. Template names must be unique per endpoint+core pair (duplicate saves return an error).

**Load from source** (collapsible) offers two paths (template first by default):

- **From query template** — pick a saved template scoped to the current endpoint and core; switching cores (e.g. `customers` → `products`) shows a different list.
- **From Solr URL** — same reverse-import as before; field names are validated against the live schema before applying.

Templates live in the `query_builder_templates` table (migration v2). Manage or delete saved names from the save dialog.

## Compare tab

The **Compare** tab (between Play and Analyze) runs two query setups side by side against the same core and endpoint:

1. **Source A** and **Source B** — each has **Load from source** (Solr URL or saved template), same as Query builder.
2. **Search (shared)** — one search box; both plans use this text when you click **Compare queries**.
3. **Top 10** results per side (compact `ResultDoc` list, expand/collapse).
4. **Metrics** — deterministic comparison without AI: Solr QTime, wall-clock time, total hits, max/avg scores, overlap and Jaccard on top 10, rank displacement for shared docs, and neutral hints (e.g. which side was faster).

### AI relevancy evaluation (optional)

Set on the machine running Next.js:

| Variable | Purpose |
| -------- | ------- |
| `OPENAI_API_KEY` | OpenAI API key for **Evaluate relevance (AI)** |
| `COMPARE_AI_API_KEY` | Alternative key (takes precedence if set) |
| `COMPARE_AI_MODEL` | Model id (default `gpt-4o-mini`) |

`GET /api/compare/evaluate` reports whether a key is configured. **Evaluate relevance (AI)** sends trimmed top-10 snippets and returns a structured verdict (`a`, `b`, or `tie`) with reasons.

## Regenerate seed JSON

```bash
npm run seed:solr
```

Then follow [`solr/README.md`](solr/README.md) if you need a full re-index.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev:stack` | Node launcher: find `docker`, Compose up Solr, then `next dev` |
| `npm run stop:stack` | Node launcher: Compose down + kill port **3000** |
| `npm run dev` | Next.js only (Solr must already be running) |
| `npm run db:migrate` | Create/update SQLite schema (WAL + sqlite-vec) |
| `npm run seed:solr` | Rewrite `solr/data/*.json` |
| `npm run build` | Production build |
| `npm run screenshots` | Regenerate README preview PNGs (requires `dev:stack` + Chromium) |

### Regenerating screenshots

With Solr and the app running:

```bash
npm run dev:stack                    # separate terminal
npx playwright install chromium      # once, after npm install
npm run screenshots
```

Writes PNGs to [`docs/screenshots/`](docs/screenshots/).

## License

Apache Solr and bundled Solr config derive from the Apache License 2.0 where applicable. Application code: see repository license if present.
