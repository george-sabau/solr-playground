import type { EmbeddingChunk } from "./types";

/** Stub for future semantic search over schema/docs. */
export interface VectorRepository {
  upsertChunk(chunk: EmbeddingChunk): void;
  deleteChunk(chunkId: string): void;
  search(_query: Float32Array, _limit?: number): EmbeddingChunk[];
}

export class StubVectorRepository implements VectorRepository {
  upsertChunk(_chunk: EmbeddingChunk): void {
    // no-op until embedding pipeline exists
  }

  deleteChunk(_chunkId: string): void {
    // no-op
  }

  search(_query: Float32Array, _limit = 10): EmbeddingChunk[] {
    return [];
  }
}
