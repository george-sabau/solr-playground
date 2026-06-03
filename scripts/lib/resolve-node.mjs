/**
 * Resolve a Node.js executable matching .nvmrc / package.json engines.
 * On Windows, npm and Next may otherwise pick a different Node from PATH
 * (e.g. Program Files Node 24 vs Cursor Node 22).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function nodeVersion(nodeExe) {
  const result = spawnSync(nodeExe, ["-p", "process.versions.node"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function readTargetNodeMajor(repoRoot) {
  try {
    const raw = readFileSync(join(repoRoot, ".nvmrc"), "utf8").trim();
    const match = raw.match(/^v?(\d+)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function listNodeCandidates() {
  const candidates = [];

  if (process.env.NODE_EXE?.trim()) {
    candidates.push(process.env.NODE_EXE.trim());
  }

  if (process.platform === "win32") {
    const where = spawnSync("where.exe", ["node"], {
      encoding: "utf8",
      shell: true,
    });
    if (where.status === 0) {
      for (const line of where.stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) candidates.push(trimmed);
      }
    }
  } else {
    const which = spawnSync("which", ["node"], { encoding: "utf8" });
    if (which.status === 0) {
      const trimmed = which.stdout.trim();
      if (trimmed) candidates.push(trimmed);
    }
  }

  candidates.push(process.execPath);
  return candidates;
}

/**
 * @param {string} repoRoot
 * @returns {string} Absolute path to node executable
 */
export function resolveNodeExe(repoRoot) {
  const targetMajor = readTargetNodeMajor(repoRoot) ?? 22;
  const seen = new Set();

  for (const exe of listNodeCandidates()) {
    const key = exe.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!existsSync(exe)) continue;

    const version = nodeVersion(exe);
    if (!version) continue;

    const major = Number(version.split(".")[0]);
    if (major === targetMajor) {
      return exe;
    }
  }

  console.warn(
    `[resolve-node] No Node ${targetMajor} found on PATH; using ${process.execPath} (${process.version}). Install Node ${targetMajor} (see .nvmrc) for best results.`,
  );
  return process.execPath;
}

/**
 * @param {string} nodeExe
 * @param {NodeJS.ProcessEnv} [baseEnv]
 */
export function envWithNodeFirst(nodeExe, baseEnv = process.env) {
  const nodeDir = dirname(nodeExe);
  const sep = process.platform === "win32" ? ";" : ":";
  const pathKey =
    Object.keys(baseEnv).find((key) => key.toLowerCase() === "path") ?? "Path";
  const existing = baseEnv[pathKey] ?? "";

  return {
    ...baseEnv,
    [pathKey]: `${nodeDir}${sep}${existing}`,
    NODE: nodeExe,
  };
}

/**
 * @param {string} nodeExe
 * @param {string} repoRoot
 * @returns {boolean}
 */
export function canLoadBetterSqlite3(nodeExe, repoRoot) {
  const result = spawnSync(
    nodeExe,
    ["-e", "require('better-sqlite3');"],
    { stdio: "pipe", cwd: repoRoot },
  );
  return result.status === 0;
}

/**
 * @param {string} nodeExe
 * @param {string} repoRoot
 * @returns {import('node:child_process').SpawnSyncReturns<Buffer>}
 */
export function rebuildBetterSqlite3(nodeExe, repoRoot) {
  const npmCliResult = spawnSync(
    nodeExe,
    ["-p", "require.resolve('npm/bin/npm-cli.js')"],
    { encoding: "utf8", cwd: repoRoot },
  );

  if (npmCliResult.status === 0 && npmCliResult.stdout.trim()) {
    return spawnSync(
      nodeExe,
      [npmCliResult.stdout.trim(), "rebuild", "better-sqlite3"],
      { cwd: repoRoot, stdio: "inherit", env: envWithNodeFirst(nodeExe) },
    );
  }

  return spawnSync("npm", ["rebuild", "better-sqlite3"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
    env: envWithNodeFirst(nodeExe),
  });
}

/**
 * @param {string} repoRoot
 * @param {{ label?: string }} [options]
 * @returns {string} nodeExe
 */
export function ensureBetterSqlite3ForNode(repoRoot, options = {}) {
  const label = options.label ?? "native-modules";
  const nodeExe = resolveNodeExe(repoRoot);
  const version = nodeVersion(nodeExe) ?? "unknown";

  if (canLoadBetterSqlite3(nodeExe, repoRoot)) {
    console.log(`[${label}] better-sqlite3 OK (Node ${version})`);
    return nodeExe;
  }

  console.log(
    `[${label}] Rebuilding better-sqlite3 for Node ${version} (${nodeExe})…`,
  );
  const rebuild = rebuildBetterSqlite3(nodeExe, repoRoot);

  if (rebuild.status !== 0 || !canLoadBetterSqlite3(nodeExe, repoRoot)) {
    console.error(`
[${label}] better-sqlite3 failed to load for Node ${version}.

Fix:
  • Use Node ${readTargetNodeMajor(repoRoot) ?? 22} (see .nvmrc): nvm use / fnm use
  • npm ci
  • Or set NODE_EXE to your Node ${readTargetNodeMajor(repoRoot) ?? 22} binary and run again
`);
    process.exit(1);
  }

  console.log(`[${label}] better-sqlite3 rebuilt successfully`);
  return nodeExe;
}
