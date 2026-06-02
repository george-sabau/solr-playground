/**
 * Stops Solr (Docker Compose) and frees port 3000 (kill-port).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { findDockerExe } from "./lib/find-docker.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

function runDocker(args, dockerExe) {
  return spawnSync(dockerExe, args, {
    stdio: "inherit",
    cwd: repoRoot,
    shell: false,
  });
}

const dockerExe = findDockerExe(repoRoot);
if (dockerExe) {
  runDocker(
    [
      "compose",
      "-f",
      "solr/docker-compose.yml",
      "--project-directory",
      "solr",
      "down",
    ],
    dockerExe
  );
} else {
  console.warn(
    "[stop:stack] Docker not found — skipping compose down. Set DOCKER_EXE or install Docker Desktop."
  );
}

const killPort = require("kill-port");
try {
  await killPort(3000);
} catch {
  /* port may already be free */
}
