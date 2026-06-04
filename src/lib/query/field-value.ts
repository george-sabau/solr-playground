import type { SchemaField } from "@/types/solr";
import type { SchemaSnapshot } from "@/lib/schema/context";

export function findSchemaField(
  schema: SchemaSnapshot | null | undefined,
  fieldName: string
): SchemaField | undefined {
  if (!schema?.fields?.length || !fieldName.trim()) return undefined;
  return schema.fields.find((f) => f.name === fieldName);
}

export function isBooleanField(
  schema: SchemaSnapshot | null | undefined,
  fieldName: string
): boolean {
  const field = findSchemaField(schema, fieldName);
  return field?.type === "boolean";
}

/** Suggested values for filter UI (booleans only; others use free text). */
export function filterValueOptionsForField(
  schema: SchemaSnapshot | null | undefined,
  fieldName: string
): string[] | null {
  if (isBooleanField(schema, fieldName)) {
    return ["true", "false"];
  }
  return null;
}
