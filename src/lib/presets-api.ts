import type { ConnectionState } from "@/lib/persistence/types";

export type HydrationStatus = "idle" | "loading" | "ready" | "error";

export async function fetchConnections(): Promise<ConnectionState> {
  const res = await fetch("/api/presets/connections", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load connections (${res.status})`);
  }
  return res.json() as Promise<ConnectionState>;
}

export async function saveConnections(state: ConnectionState): Promise<void> {
  const res = await fetch("/api/presets/connections", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    throw new Error(`Failed to save connections (${res.status})`);
  }
}

export interface MigrateLocalResult {
  migrated: boolean;
  reason?: string;
}

export async function migrateFromLocalStorage(
  payload: unknown
): Promise<MigrateLocalResult> {
  const res = await fetch("/api/presets/migrate-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    throw new Error(`Migration failed (${res.status})`);
  }
  return res.json() as Promise<MigrateLocalResult>;
}

const LEGACY_STORAGE_KEY = "solr-playground";
const MIGRATED_FLAG_KEY = "solr-playground-db-migrated";

export function readLegacyLocalStoragePayload(): unknown | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(MIGRATED_FLAG_KEY) === "1") return null;
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function markLocalStorageMigrated(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIGRATED_FLAG_KEY, "1");
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
