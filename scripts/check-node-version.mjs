/**
 * preinstall: relay install/ci to Node 22 when system npm uses another version.
 * Skips non-install commands (rebuild, run, test, …).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readTargetNodeMajor } from "./lib/resolve-node.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.env.npm_command ?? "";
const installCommands = new Set(["install", "ci", "add", "install-test"]);

if (process.env.SOLR_PLAYGROUND_NPM_RELAY === "1") {
  process.exit(0);
}

if (!installCommands.has(npmCommand)) {
  process.exit(0);
}

const targetMajor = readTargetNodeMajor(repoRoot) ?? 22;
const currentMajor = Number(process.version.slice(1).split(".")[0]);

if (currentMajor === targetMajor) {
  process.exit(0);
}

const runNpm = join(repoRoot, "scripts", "run-npm.mjs");
console.log(
  `\n[preinstall] npm is running on Node ${process.version}; relaying "${npmCommand}" to Node ${targetMajor}…\n`,
);

const relay = spawnSync(
  process.execPath,
  [runNpm, npmCommand],
  {
    stdio: "inherit",
    cwd: repoRoot,
    env: { ...process.env, SOLR_PLAYGROUND_NPM_RELAY: "1" },
  },
);

process.exit(relay.status ?? 1);
