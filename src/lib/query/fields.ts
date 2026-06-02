import type { SchemaField } from "@/types/solr";
import type { SchemaSnapshot } from "@/lib/schema/context";

function isInternalField(name: string): boolean {
  return (
    name === "_version_" ||
    name === "_root_" ||
    name === "_nest_path_" ||
    (name.startsWith("_") && name.endsWith("_"))
  );
}

/** Indexed static fields suitable for field-targeted queries in the builder. */
export function getSearchableFields(
  schema: SchemaSnapshot | null | undefined
): SchemaField[] {
  if (!schema?.fields?.length) return [];
  return schema.fields
    .filter(
      (f) => f.indexed !== false && !isInternalField(f.name) && f.name !== "score"
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
