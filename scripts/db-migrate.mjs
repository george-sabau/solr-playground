import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sqliteVec from "sqlite-vec";
import {
  applyMigrations,
  openDatabase,
  resolveDatabasePath,
} from "../src/lib/persistence/migrate-runner.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const rawPath = resolveDatabasePath(process.env.DATABASE_PATH);
const dbPath =
  rawPath === ":memory:"
    ? rawPath
    : resolve(
        repoRoot,
        rawPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rawPath)
          ? rawPath
          : rawPath
      );

const db = openDatabase(dbPath);
sqliteVec.load(db);
applyMigrations(db);
db.close();
console.log(`[db:migrate] Applied migrations at ${dbPath}`);
