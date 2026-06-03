import type { EmbeddingChunk } from "./types";

/** Stub for future semantic search over schema/docs. */
export interface VectorRepository {
  upsertChunk(chunk: EmbeddingChunk): void;
  deleteChunk(chunkId: string): void;
  search(_query: Float32Array, _limit?: number): EmbeddingChunk[];
}

export class StubVectorRepository implements VectorRepository {
  upsertChunk(chunk: EmbeddingChunk): void {
    void chunk;
  }

  deleteChunk(chunkId: string): void {
    void chunkId;
  }

  search(query: Float32Array, limit = 10): EmbeddingChunk[] {
    void query;
    void limit;
    return [];
  }
}
