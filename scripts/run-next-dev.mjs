/**
 * Start Next.js dev with the Node version from .nvmrc and a matching better-sqlite3 build.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureBetterSqlite3ForNode,
  envWithNodeFirst,
} from "./lib/resolve-node.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const nodeExe = ensureBetterSqlite3ForNode(repoRoot, { label: "dev" });
const nextBin = join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const dbPath = join(repoRoot, ".data", "solr-playground.db");

const next = spawnSync(nodeExe, [nextBin, "dev"], {
  stdio: "inherit",
  cwd: repoRoot,
  env: envWithNodeFirst(nodeExe, {
    ...process.env,
    DATABASE_PATH: process.env.DATABASE_PATH ?? dbPath,
  }),
});

process.exit(next.status ?? 0);
