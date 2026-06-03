import { resetDbForTests, resetPersistenceForTests } from "@/lib/persistence";

/** Reset singletons and in-memory DB between tests. */
export function resetTestPersistence(): void {
  resetPersistenceForTests();
  resetDbForTests();
}

export function enableInMemoryDb(): void {
  process.env.DATABASE_PATH = ":memory:";
}

export function clearInMemoryDbEnv(): void {
  delete process.env.DATABASE_PATH;
}
