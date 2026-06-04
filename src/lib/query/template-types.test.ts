import { describe, expect, it } from "vitest";
import {
  buildTemplatePayload,
  cloneBuilderStateForApply,
  deserializeTemplatePayload,
  serializeTemplatePayload,
  stripBuilderStateIds,
} from "@/lib/query/template-types";
import {
  createFieldConfig,
  createMatcher,
  DEFAULT_BUILDER_STATE,
} from "@/lib/query/types";

describe("template payload helpers", () => {
  it("stripBuilderStateIds removes ephemeral matcher ids", () => {
    const field = createFieldConfig("city");
    field.matchers.push(createMatcher("fuzzy", { boost: 2 }));
    const state = {
      ...DEFAULT_BUILDER_STATE,
      searchText: "test",
      fields: [field],
    };

    const stripped = stripBuilderStateIds(state);
    expect(stripped.fields[0]?.matchers).toHaveLength(2);
    expect(stripped.fields[0]?.matchers.every((m) => m.id === "")).toBe(true);
    expect(stripped.fields[0]?.id).toBe("");
  });

  it("cloneBuilderStateForApply assigns fresh ids", () => {
    const stripped = stripBuilderStateIds({
      ...DEFAULT_BUILDER_STATE,
      searchText: "Par",
      fields: [createFieldConfig("city")],
    });

    const cloned = cloneBuilderStateForApply(stripped);
    expect(cloned.fields[0]?.matchers[0]?.id).not.toBe("");
    expect(cloned.searchText).toBe("Par");
  });

  it("buildTemplatePayload includes parser and optional sourceUrl", () => {
    const payload = buildTemplatePayload(
      "edismax",
      { ...DEFAULT_BUILDER_STATE, searchText: "x" },
      "http://localhost/solr/select"
    );
    expect(payload.version).toBe(1);
    expect(payload.parser).toBe("edismax");
    expect(payload.sourceUrl).toBe("http://localhost/solr/select");
    expect(payload.builder.searchText).toBe("x");
  });

  it("round-trips multiple filter and boost queries in payload", () => {
    const state = {
      ...DEFAULT_BUILDER_STATE,
      filterQueries: [
        { id: "", field: "is_active", value: "true" },
        { id: "", field: "country", value: "FR" },
      ],
      boostQueries: [
        {
          id: "",
          field: "interests",
          mode: "term" as const,
          value: "design",
          boost: 10,
        },
      ],
    };
    const payload = buildTemplatePayload("lucene", state);
    const restored = deserializeTemplatePayload(
      serializeTemplatePayload(payload)
    );
    expect(restored.builder.filterQueries).toHaveLength(2);
    expect(restored.builder.boostQueries).toHaveLength(1);
    expect(restored.builder.filterQueries[0]?.field).toBe("is_active");
  });

  it("migrates legacy single filterQuery and boostQuery", () => {
    const legacy = JSON.stringify({
      version: 1,
      parser: "lucene",
      builder: {
        searchText: "",
        fields: [],
        combineWith: "OR",
        edismax: { mm: "", min: "", tie: "", qfOverride: "" },
        filterQuery: { field: "is_active", value: "true" },
        boostQuery: {
          field: "interests",
          mode: "term",
          value: "design",
          boost: 10,
        },
      },
    });
    const restored = deserializeTemplatePayload(legacy);
    expect(restored.builder.filterQueries).toHaveLength(1);
    expect(restored.builder.filterQueries[0]?.field).toBe("is_active");
    expect(restored.builder.boostQueries).toHaveLength(1);
    expect(restored.builder.boostQueries[0]?.field).toBe("interests");
  });
});
