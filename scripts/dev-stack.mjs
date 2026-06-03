/**
 * Starts Solr (Docker Compose) then Next.js dev server.
 * Resolves `docker` when missing from PATH (see scripts/lib/find-docker.mjs).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dockerDaemonOk, findDockerExe } from "./lib/find-docker.mjs";
import {
  ensureBetterSqlite3ForNode,
} from "./lib/resolve-node.mjs";
import { buildNextDevEnv } from "./lib/load-project-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function tryDocker(args, dockerExe) {
  return spawnSync(dockerExe, args, {
    stdio: "inherit",
    cwd: repoRoot,
    shell: false,
  });
}

const dockerExe = findDockerExe(repoRoot);
if (!dockerExe) {
  console.error(`
[dev:stack] Docker CLI not found (or docker.exe does not run).

Fix:
  • Install Docker Desktop for Windows, start it, and wait until it says "Engine running".
  • Restart Cursor so PATH includes Docker, or set DOCKER_EXE to the full path of docker.exe:

      $env:DOCKER_EXE = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
      npm run dev:stack

  • If Docker is only inside WSL, run this project from WSL or add Docker to Windows PATH.

Then run: npm run dev:stack
`);
  process.exit(1);
}

if (!dockerDaemonOk(dockerExe, repoRoot)) {
  console.error(`
[dev:stack] Docker is installed but the engine is not running.

Fix:
  • Open Docker Desktop and wait until the status shows "Engine running" (whale icon steady, not starting).
  • On Windows, you can start it from the Start menu: "Docker Desktop".
  • Then run again: npm run dev:stack

If Docker Desktop is already open, wait a minute and retry — first start can take 1–2 minutes.
`);
  process.exit(1);
}

const composeArgs = [
  "compose",
  "-f",
  "solr/docker-compose.yml",
  "--project-directory",
  "solr",
  "up",
  "-d",
];

const up = tryDocker(composeArgs, dockerExe);
if (up.error || up.status !== 0) {
  process.exit(up.status ?? 1);
}

const nodeExe = ensureBetterSqlite3ForNode(repoRoot, {
  label: "dev:stack",
  forceRebuild: true,
});
const nextBin = join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const dbPath = join(repoRoot, ".data", "solr-playground.db");
const next = spawnSync(nodeExe, [nextBin, "dev"], {
  stdio: "inherit",
  cwd: repoRoot,
  env: buildNextDevEnv(nodeExe, repoRoot, {
    DATABASE_PATH: process.env.DATABASE_PATH ?? dbPath,
  }),
});

process.exit(next.status ?? 0);
