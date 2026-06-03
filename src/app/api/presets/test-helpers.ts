import {
  buildTemplatePayload,
  type QueryTemplatePayload,
} from "@/lib/query/template-types";
import {
  createFieldConfig,
  DEFAULT_BUILDER_STATE,
  DEFAULT_EDISMAX,
  type QueryParserMode,
} from "@/lib/query/types";
import {
  clearInMemoryDbEnv,
  resetTestPersistence,
  useInMemoryDb,
} from "@/lib/persistence/test-helpers";

export function setupPresetsApiTests(): void {
  resetTestPersistence();
  useInMemoryDb();
}

export function teardownPresetsApiTests(): void {
  resetTestPersistence();
  clearInMemoryDbEnv();
}

export function sampleTemplatePayload(
  parser: QueryParserMode = "lucene"
): QueryTemplatePayload {
  return buildTemplatePayload(parser, {
    ...DEFAULT_BUILDER_STATE,
    searchText: "Par",
    fields: [createFieldConfig("city")],
    edismax: { ...DEFAULT_EDISMAX },
  });
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
