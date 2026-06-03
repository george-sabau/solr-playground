import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export const MIGRATION_VERSION = 2;

/**
 * @param {import('better-sqlite3').Database} db
 */
function hasMigration(db, version) {
  const row = db
    .prepare("SELECT version FROM _schema_migrations WHERE version = ?")
    .get(version);
  return !!row;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} version
 */
function recordMigration(db, version) {
  db.prepare("INSERT INTO _schema_migrations (version) VALUES (?)").run(version);
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function applyMigrationV1(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS solr_endpoints (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL,
      auth_user TEXT,
      auth_pass_encrypted TEXT,
      last_core TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS query_builder_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS embedding_chunks USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding float[384]
    );
  `);

  recordMigration(db, 1);
}

const TEMPLATES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS query_builder_templates (
    id TEXT PRIMARY KEY NOT NULL,
    endpoint_id TEXT NOT NULL,
    core TEXT NOT NULL,
    name TEXT NOT NULL,
    parser TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(endpoint_id, core, name)
  );
`;

/**
 * Rebuild templates table when v2 columns are missing (e.g. migration row present but DDL skipped).
 * @param {import('better-sqlite3').Database} db
 */
export function ensureQueryBuilderTemplatesV2(db) {
  const cols = db.prepare("PRAGMA table_info(query_builder_templates)").all();
  const hasEndpointId = cols.some((c) => c.name === "endpoint_id");

  if (!hasEndpointId) {
    db.exec(`DROP TABLE IF EXISTS query_builder_templates;`);
    db.exec(TEMPLATES_TABLE_SQL);
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function applyMigrationV2(db) {
  ensureQueryBuilderTemplatesV2(db);
  if (!hasMigration(db, 2)) {
    recordMigration(db, 2);
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function applyMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (!hasMigration(db, 1)) {
    applyMigrationV1(db);
  }
  if (!hasMigration(db, 2)) {
    applyMigrationV2(db);
  } else {
    ensureQueryBuilderTemplatesV2(db);
  }
}

/**
 * @param {string} [override]
 */
export function resolveDatabasePath(override) {
  return (
    override ??
    process.env.DATABASE_PATH ??
    ".data/solr-playground.db"
  );
}

/**
 * @param {string} dbPath
 * @returns {import('better-sqlite3').Database}
 */
export function openDatabase(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
