import type { QueryParserMode } from "@/lib/query/types";
import type { QueryTemplatePayload } from "@/lib/query/template-types";
import type { ConnectionState, QueryBuilderTemplateRecord } from "./types";

export interface PersistenceRepository {
  getConnectionState(): ConnectionState;
  saveConnectionState(state: ConnectionState): void;
  hasAnyEndpoints(): boolean;

  listQueryTemplates(endpointId: string, core: string): QueryBuilderTemplateRecord[];
  getQueryTemplate(id: string): QueryBuilderTemplateRecord | null;
  createQueryTemplate(input: {
    endpointId: string;
    core: string;
    name: string;
    parser: QueryParserMode;
    payload: QueryTemplatePayload;
  }): string;
  updateQueryTemplate(
    id: string,
    input: {
      parser: QueryParserMode;
      payload: QueryTemplatePayload;
    }
  ): void;
  deleteQueryTemplate(id: string): void;
}
