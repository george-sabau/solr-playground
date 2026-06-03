import type { SolrEndpoint } from "@/lib/solr/endpoints";
import type { QueryParserMode } from "@/lib/query/types";
import type { QueryTemplatePayload } from "@/lib/query/template-types";

/** Persisted Solr connection list + active endpoint id. */
export interface ConnectionState {
  endpoints: SolrEndpoint[];
  activeEndpointId: string;
}

export interface QueryBuilderTemplateRecord {
  id: string;
  endpointId: string;
  core: string;
  name: string;
  parser: QueryParserMode;
  payload: QueryTemplatePayload;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated use QueryBuilderTemplateRecord */
export type QueryBuilderTemplate = QueryBuilderTemplateRecord;

/** Embedding chunk row (stub for sqlite-vec search). */
export interface EmbeddingChunk {
  chunkId: string;
  /** 384-dimensional vector placeholder. */
  embedding: Float32Array;
}

export class DuplicateTemplateNameError extends Error {
  constructor(name: string, core: string) {
    super(`A template named "${name}" already exists for core "${core}".`);
    this.name = "DuplicateTemplateNameError";
  }
}
