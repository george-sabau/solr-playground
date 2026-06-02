/**
 * Resolve the Docker CLI executable (Windows-friendly: PATH, where.exe, common paths).
 * Uses `docker --version` (client-only) — not `docker version`, which needs a running engine.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** @param {string} dockerExe @param {string} cwd */
function dockerClientOk(dockerExe, cwd) {
  const r = spawnSync(dockerExe, ["--version"], {
    stdio: "ignore",
    cwd,
    shell: false,
  });
  return r.status === 0;
}

/** @param {string} cwd */
function whereDockerOnWindows(cwd) {
  const whereExe = join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "where.exe"
  );
  const r = spawnSync(whereExe, ["docker"], {
    encoding: "utf8",
    cwd,
    shell: false,
  });
  if (r.status !== 0 || !r.stdout) return null;
  const line = r.stdout.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) return null;
  const p = line.trim();
  return existsSync(p) && dockerClientOk(p, cwd) ? p : null;
}

/** @param {string} dockerExe @param {string} cwd */
export function dockerDaemonOk(dockerExe, cwd) {
  const r = spawnSync(dockerExe, ["info"], {
    stdio: "ignore",
    cwd,
    shell: false,
  });
  return r.status === 0;
}

/** @param {string} cwd */
export function findDockerExe(cwd) {
  const raw = process.env.DOCKER_EXE?.trim().replace(/^["']|["']$/g, "");
  if (raw && existsSync(raw) && dockerClientOk(raw, cwd)) {
    return raw;
  }

  if (dockerClientOk("docker", cwd)) {
    return "docker";
  }

  if (process.platform === "win32") {
    const fromWhere = whereDockerOnWindows(cwd);
    if (fromWhere) return fromWhere;

    const pf = process.env.ProgramFiles || "C:\\Program Files";
    const pfx86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const local = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || "", "AppData", "Local");

    const candidates = [
      join(pf, "Docker", "Docker", "resources", "bin", "docker.exe"),
      join(pfx86, "Docker", "Docker", "resources", "bin", "docker.exe"),
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
      join(local, "Programs", "Docker", "Docker", "resources", "bin", "docker.exe"),
    ];

    for (const p of candidates) {
      if (p && existsSync(p) && dockerClientOk(p, cwd)) {
        return p;
      }
    }
  }

  return null;
}
