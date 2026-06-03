import { describe, expect, it } from "vitest";
import {
  TemplateValidationError,
  validateBuilderAgainstSchema,
} from "@/lib/query/validate-builder";
import { createFieldConfig } from "@/lib/query/types";
import type { SchemaField } from "@/types/solr";

const schema: SchemaField[] = [
  { name: "name", type: "string", indexed: true, stored: true },
  { name: "email", type: "string", indexed: true, stored: true },
];

describe("validateBuilderAgainstSchema", () => {
  it("accepts fields present in schema", () => {
    const result = validateBuilderAgainstSchema(
      {
        searchText: "test",
        fields: [createFieldConfig("name")],
        combineWith: "OR",
        edismax: { mm: "", min: "", tie: "", qfOverride: "" },
      },
      "lucene",
      schema
    );
    expect(result.ok).toBe(true);
    expect(result.state.fields[0]?.field).toBe("name");
  });

  it("rejects fields missing from schema", () => {
    expect(() =>
      validateBuilderAgainstSchema(
        {
          searchText: "test",
          fields: [createFieldConfig("unknown_field")],
          combineWith: "OR",
          edismax: { mm: "", min: "", tie: "", qfOverride: "" },
        },
        "lucene",
        schema
      )
    ).toThrow(TemplateValidationError);
  });
});
