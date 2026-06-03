import nextEnv from "@next/env";
import { envWithNodeFirst } from "./resolve-node.mjs";

const { loadEnvConfig } = nextEnv;

/**
 * Load .env*, .env.local, etc. from the repo root and merge with process.env.
 * Needed when Next.js infers a parent directory as workspace root (extra lockfiles).
 */
export function loadProjectEnv(repoRoot) {
  const { combinedEnv } = loadEnvConfig(repoRoot, true);
  return {
    ...combinedEnv,
    ...process.env,
  };
}

export function buildNextDevEnv(nodeExe, repoRoot, extra = {}) {
  return envWithNodeFirst(nodeExe, {
    ...loadProjectEnv(repoRoot),
    SOLR_PLAYGROUND_ROOT: repoRoot,
    ...extra,
  });
}
