import type Database from "better-sqlite3";
import { applyMigrations } from "./migrate-runner.mjs";

export { MIGRATION_VERSION } from "./migrate-runner.mjs";

export function runMigrations(db: Database.Database): void {
  applyMigrations(db);
}
