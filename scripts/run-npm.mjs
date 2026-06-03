/**
 * Run npm with the project Node (.nvmrc) — avoids EBADENGINE / better-sqlite3 ABI mismatch
 * when system npm uses Node 24 but the project targets Node 22.
 *
 * Usage: node scripts/run-npm.mjs install | ci | rebuild better-sqlite3 | ...
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureBetterSqlite3ForNode,
  envWithNodeFirst,
  resolveNodeExe,
  resolveNpmCli,
} from "./lib/resolve-node.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const nodeExe = resolveNodeExe(repoRoot);

let npmCli;
try {
  npmCli = resolveNpmCli(nodeExe);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-npm.mjs <npm-args…>");
  process.exit(1);
}

const npm = spawnSync(nodeExe, [npmCli, ...args], {
  stdio: "inherit",
  cwd: repoRoot,
  env: envWithNodeFirst(nodeExe),
});

if (npm.status === 0 && args[0] === "rebuild") {
  ensureBetterSqlite3ForNode(repoRoot, { label: "run-npm" });
}

process.exit(npm.status ?? 1);
