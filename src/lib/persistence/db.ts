import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { runMigrations } from "./migrate";
import * as schema from "./schema";

/** Repo root (three levels up from this file). */
const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");

const globalForDb = globalThis as unknown as {
  __solrPlaygroundDb?: Database.Database;
  __solrPlaygroundDrizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_PATH?.trim();
  if (raw === ":memory:") return raw;
  if (raw) {
    return isAbsolute(raw) ? raw : join(REPO_ROOT, raw);
  }
  return join(REPO_ROOT, ".data", "solr-playground.db");
}

export function getDatabasePath(): string {
  return resolveDatabasePath();
}

function loadSqliteVecExtension(db: Database.Database): void {
  try {
    sqliteVec.load(db);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(
      `[db] sqlite-vec extension not loaded (embedding search disabled): ${message}`
    );
  }
}

export function getDb(): Database.Database {
  if (globalForDb.__solrPlaygroundDb) {
    return globalForDb.__solrPlaygroundDb;
  }

  const dbPath = resolveDatabasePath();
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  loadSqliteVecExtension(db);
  runMigrations(db);

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__solrPlaygroundDb = db;
  }

  return db;
}

export function getDrizzle() {
  if (!globalForDb.__solrPlaygroundDrizzle) {
    globalForDb.__solrPlaygroundDrizzle = drizzle(getDb(), { schema });
  }
  return globalForDb.__solrPlaygroundDrizzle;
}

/** Close and clear cached DB handles (Vitest isolation). */
export function resetDbForTests(): void {
  if (globalForDb.__solrPlaygroundDb) {
    try {
      globalForDb.__solrPlaygroundDb.close();
    } catch {
      /* already closed */
    }
  }
  globalForDb.__solrPlaygroundDb = undefined;
  globalForDb.__solrPlaygroundDrizzle = undefined;
}
