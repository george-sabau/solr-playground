import type { SchemaField } from "@/types/solr";
import type { BuilderState, QueryParserMode } from "@/lib/query/types";
import {
  TemplateValidationError,
  validateBuilderAgainstSchema,
} from "@/lib/query/validate-builder";

export function applyBuilderImport({
  parser,
  state,
  warnings: importWarnings,
  onChange,
  onParserChange,
  onWarnings,
  onError,
  searchableFields,
}: {
  parser: QueryParserMode;
  state: BuilderState;
  warnings?: string[];
  onChange: (next: BuilderState) => void;
  onParserChange: (p: QueryParserMode) => void;
  onWarnings: (warnings: string[]) => void;
  onError: (message: string | null) => void;
  searchableFields: SchemaField[];
}): void {
  try {
    const result = validateBuilderAgainstSchema(
      state,
      parser,
      searchableFields
    );
    onWarnings([...(importWarnings ?? []), ...result.warnings]);
    onChange(result.state);
    onParserChange(parser);
  } catch (err) {
    if (err instanceof TemplateValidationError) {
      onError(err.message);
      onWarnings([]);
      return;
    }
    onError(
      err instanceof Error ? err.message : "Could not apply query configuration."
    );
    onWarnings([]);
  }
}
