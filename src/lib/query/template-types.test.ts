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

  it("round-trips filter and boost query in payload", () => {
    const state = {
      ...DEFAULT_BUILDER_STATE,
      filterQuery: { field: "is_active", value: "true" },
      boostQuery: {
        field: "interests",
        mode: "term" as const,
        value: "design",
        boost: 10,
      },
    };
    const payload = buildTemplatePayload("lucene", state);
    const restored = deserializeTemplatePayload(
      serializeTemplatePayload(payload)
    );
    expect(restored.builder.filterQuery).toEqual(state.filterQuery);
    expect(restored.builder.boostQuery).toEqual(state.boostQuery);
  });
});
