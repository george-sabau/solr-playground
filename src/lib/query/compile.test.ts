import { describe, expect, it } from "vitest";
import {
  compileBoostToBq,
  compileBuilderSearch,
  compileFieldsToQ,
  compileFilterToFq,
  escapeLuceneTerm,
} from "@/lib/query/compile";
import {
  createFieldConfig,
  DEFAULT_BUILDER_STATE,
} from "@/lib/query/types";

describe("escapeLuceneTerm", () => {
  it("escapes Lucene special characters", () => {
    expect(escapeLuceneTerm("foo+bar")).toBe("foo\\+bar");
    expect(escapeLuceneTerm('a"b')).toBe('a\\"b');
  });
});

describe("compileFieldsToQ", () => {
  it("returns *:* when search text is empty", () => {
    expect(
      compileFieldsToQ([createFieldConfig("name")], "", { combineWith: "AND" })
    ).toBe("*:*");
  });

  it("compiles a single field term query", () => {
    const q = compileFieldsToQ(
      [createFieldConfig("name")],
      "smith",
      { combineWith: "AND" }
    );
    expect(q).toBe("name:smith");
  });
});

describe("compileFilterToFq", () => {
  it("compiles boolean filter as true/false", () => {
    expect(
      compileFilterToFq(
        { field: "is_active", value: "true" },
        "boolean"
      )
    ).toBe("is_active:true");
    expect(
      compileFilterToFq(
        { field: "is_active", value: "FALSE" },
        "boolean"
      )
    ).toBe("is_active:false");
  });

  it("compiles string filter with quoting when needed", () => {
    expect(
      compileFilterToFq({ field: "email", value: "a@b.com" })
    ).toBe("email:a@b.com");
  });
});

describe("compileBoostToBq", () => {
  it("compiles field boost with caret", () => {
    expect(
      compileBoostToBq({
        field: "interests",
        mode: "term",
        value: "design",
        boost: 10,
      })
    ).toBe("interests:design^10");
  });
});

describe("compileBuilderSearch", () => {
  it("includes fq and bq in extra when configured", () => {
    const plan = compileBuilderSearch(
      {
        ...DEFAULT_BUILDER_STATE,
        searchText: "paris",
        fields: [createFieldConfig("city")],
        filterQuery: { field: "is_active", value: "true" },
        boostQuery: {
          field: "interests",
          mode: "term",
          value: "design",
          boost: 10,
        },
      },
      "lucene",
      { fieldTypes: { is_active: "boolean" } }
    );
    expect(plan.extra.fq).toBe("is_active:true");
    expect(plan.extra.bq).toBe("interests:design^10");
    expect(plan.summary).toContain("fq=is_active:true");
    expect(plan.summary).toContain("bq=interests:design^10");
  });
});
