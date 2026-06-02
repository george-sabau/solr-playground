# Local Solr showcase (Apache Solr 9)

Single Docker container with two cores: **`products`** and **`customers`**, pre-seeded for the Solr Playground UI.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)

## One command from repo root (with the Next.js app)

From the **repository root** (parent of this folder):

```bash
npm run dev:stack
```

Stops Solr **and** frees the app port from the root:

```bash
npm run stop:stack
```

Those scripts use `scripts/dev-stack.mjs` / `scripts/stop-stack.mjs`, which resolve **`docker`** on PATH or Docker Desktop’s default Windows install, then run `docker compose -f solr/docker-compose.yml --project-directory solr`. Set **`DOCKER_EXE`** to a full `docker.exe` path if your shell still cannot find Docker.

## Solr only (this directory)

```bash
cd solr
docker compose up -d
```

First boot can take **1–3 minutes**: Solr starts once, creates both cores, posts seed data, restarts in the foreground. Subsequent starts are fast.

- Admin UI: <http://localhost:8983/solr/#/>
- Base URL used by the app: `http://localhost:8983/solr`

## Next.js only (separate terminal)

From the **repository root**:

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — the Core Switcher should list `products` and `customers`.

## Regenerate seed JSON (optional)

```bash
node scripts/generate-solr-seed.mjs
```

Or from repo root: `npm run seed:solr`.

Then re-seed by wiping Solr data (see reset below), or `docker compose down -v` and delete `solr/var/`.

## Full reset (wipe index + re-bootstrap)

From **repository root**:

```bash
npm run stop:stack
```

Then remove the Solr data directory (PowerShell from repo root):

```powershell
Remove-Item -Recurse -Force .\solr\var -ErrorAction SilentlyContinue
```

Or from bash: `rm -rf solr/var`

Start again:

```bash
cd solr && docker compose up -d
```

Or `npm run dev:stack` from the repo root.

## Architecture note

- **One Solr container, two cores** — normal Solr deployment; lower memory than two Solr JVMs.
- **Next.js runs on the host** — fast dev workflow; the app proxies Solr via `/api/solr/[...path]`, so you do **not** need Solr CORS configuration for `localhost:3000`.

## Troubleshooting

- **Port 8983 in use** — change the left side of the port mapping in `docker-compose.yml` (e.g. `18983:8983`) and set the playground base URL to `http://localhost:18983/solr` in the UI connection settings.
- **Scripts do not run (Linux line endings)** — ensure `init/*.sh` use LF. Git on Windows with `core.autocrlf` can break this; convert with `dos2unix solr/init/*.sh` inside WSL/Git Bash if needed.

## Verify cores (manual)

With Solr up and the app running (`npm run dev` or `npm run dev:stack`):

```bash
curl -s "http://localhost:8983/solr/admin/cores?action=STATUS&wt=json" | findstr products customers
```

Or open the app header Core Switcher — you should see **products** and **customers**.
