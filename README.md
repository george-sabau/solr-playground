# Solr Playground

Sidecar UI for **Apache Solr** — query and analysis only (no data mutations). Stack: Next.js, Tailwind, Shadcn UI, Zustand.

See [`.cursor-master-plan.md`](.cursor-master-plan.md) for the roadmap and change history.

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
| `npm run seed:solr` | Rewrite `solr/data/*.json` |
| `npm run build` | Production build |

## License

Apache Solr and bundled Solr config derive from the Apache License 2.0 where applicable. Application code: see repository license if present.
