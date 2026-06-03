import type { PersistenceRepository } from "./repository";
import { SqlitePersistenceRepository } from "./sqlite-repository";
import { StubVectorRepository, type VectorRepository } from "./vector-repository";

export type {
  ConnectionState,
  QueryBuilderTemplate,
  QueryBuilderTemplateRecord,
  EmbeddingChunk,
} from "./types";
export { DuplicateTemplateNameError } from "./types";
export type { PersistenceRepository } from "./repository";
export { getDatabasePath, getDb, getDrizzle } from "./db";
export { encryptSecret, decryptSecret, isUsingDevFallbackSecret } from "./crypto";

let repository: PersistenceRepository | null = null;
let vectorRepository: VectorRepository | null = null;

export function getPersistenceRepository(): PersistenceRepository {
  if (!repository) {
    repository = new SqlitePersistenceRepository();
  }
  return repository;
}

export function getVectorRepository(): VectorRepository {
  if (!vectorRepository) {
    vectorRepository = new StubVectorRepository();
  }
  return vectorRepository;
}

export function getSqliteRepository(): SqlitePersistenceRepository {
  return getPersistenceRepository() as SqlitePersistenceRepository;
}
