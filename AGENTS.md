<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Local Solr + app (development)

- **`npm run dev:stack`** (repo root): Node launcher (`scripts/dev-stack.mjs`) uses **`scripts/lib/find-docker.mjs`** (`docker --version`, `where.exe docker`, common Windows install dirs, **`DOCKER_EXE`**) then Compose (`solr/docker-compose.yml`, project dir `solr/`) detached, then **`next dev`**.
- **`npm run stop:stack`**: Node launcher (`scripts/stop-stack.mjs`) runs **`docker compose … down`** and **`kill-port` on 3000**. Warn the user if they rely on another service on 3000.
- Solr-only or manual flow: see [`solr/README.md`](solr/README.md).
