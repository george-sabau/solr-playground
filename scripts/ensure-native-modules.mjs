/**
 * Preflight: verify better-sqlite3 loads for the project Node runtime (.nvmrc).
 * Rebuilds automatically when ABI mismatches (e.g. after switching Node versions).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureBetterSqlite3ForNode } from "./lib/resolve-node.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
ensureBetterSqlite3ForNode(repoRoot);
