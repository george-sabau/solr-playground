import type { SchemaField } from "@/types/solr";
import type { BuilderState, QueryParserMode } from "@/lib/query/types";
import { cloneBuilderStateForApply } from "@/lib/query/template-types";

export class TemplateValidationError extends Error {
  readonly missingFields: string[];

  constructor(message: string, missingFields: string[] = []) {
    super(message);
    this.name = "TemplateValidationError";
    this.missingFields = missingFields;
  }
}

export interface BuilderValidationResult {
  ok: true;
  state: BuilderState;
  warnings: string[];
}

export function validateBuilderAgainstSchema(
  builder: BuilderState,
  parser: QueryParserMode,
  searchableFields: SchemaField[]
): BuilderValidationResult {
  const schemaNames = new Set(searchableFields.map((f) => f.name));
  const usedFields = builder.fields.map((f) => f.field).filter(Boolean);
  const optionFields: string[] = [];
  if (builder.filterQuery?.field.trim()) {
    optionFields.push(builder.filterQuery.field.trim());
  }
  if (builder.boostQuery?.field.trim()) {
    optionFields.push(builder.boostQuery.field.trim());
  }
  const allReferenced = [...usedFields, ...optionFields];
  const missingFields = allReferenced.filter((name) => !schemaNames.has(name));

  if (missingFields.length > 0) {
    throw new TemplateValidationError(
      `Cannot load: field(s) not in schema: ${[...new Set(missingFields)].join(", ")}`,
      [...new Set(missingFields)]
    );
  }

  const warnings: string[] = [];

  if (usedFields.length === 0) {
    warnings.push("No fields selected in this template.");
  }

  if (
    (parser === "edismax" || parser === "dismax") &&
    builder.edismax.qfOverride.trim() === "" &&
    usedFields.length > 0
  ) {
    warnings.push(
      "Edismax/dismax mode: qf will be built from selected fields at run time."
    );
  }

  return {
    ok: true,
    state: cloneBuilderStateForApply(builder),
    warnings,
  };
}
