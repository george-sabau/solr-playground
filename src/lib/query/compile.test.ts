import { describe, expect, it } from "vitest";
import {
  buildSelectRequestUrl,
  compileBoostQueries,
  compileBuilderSearch,
  compileFieldsToQ,
  compileFilterQueries,
  compileFilterToFq,
  escapeLuceneTerm,
  formatCompiledQueryDisplay,
} from "@/lib/query/compile";
import {
  createBoostQuery,
  createFieldConfig,
  createFilterQuery,
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
        createFilterQuery({ field: "is_active", value: "true" }),
        "boolean"
      )
    ).toBe("is_active:true");
  });
});

describe("compileFilterQueries and compileBoostQueries", () => {
  it("returns multiple compiled clauses", () => {
    const state = {
      ...DEFAULT_BUILDER_STATE,
      filterQueries: [
        createFilterQuery({ field: "is_active", value: "true" }),
        createFilterQuery({ field: "country", value: "FR" }),
      ],
      boostQueries: [
        createBoostQuery({
          field: "interests",
          value: "design",
          boost: 10,
        }),
      ],
    };
    expect(
      compileFilterQueries(state, { is_active: "boolean" })
    ).toEqual(["is_active:true", "country:FR"]);
    expect(compileBoostQueries(state)).toEqual(["interests:design^10"]);
  });
});

describe("compileBuilderSearch", () => {
  it("includes fq and bq arrays when configured", () => {
    const plan = compileBuilderSearch(
      {
        ...DEFAULT_BUILDER_STATE,
        searchText: "paris",
        fields: [createFieldConfig("city")],
        filterQueries: [createFilterQuery({ field: "is_active", value: "true" })],
        boostQueries: [
          createBoostQuery({
            field: "interests",
            value: "design",
            boost: 10,
          }),
        ],
      },
      "lucene",
      { fieldTypes: { is_active: "boolean" } }
    );
    expect(plan.fq).toEqual(["is_active:true"]);
    expect(plan.bq).toEqual(["interests:design^10"]);
    expect(plan.summary).toContain("Filters:");
    expect(plan.summary).toContain("Boosts:");
    expect(formatCompiledQueryDisplay(plan)).toContain("fq: is_active:true");
    expect(formatCompiledQueryDisplay(plan)).toContain("bq: interests:design^10");
  });
});

describe("buildSelectRequestUrl", () => {
  it("encodes repeated fq and bq in the URL", () => {
    const { proxy } = buildSelectRequestUrl(
      "http://localhost:8983/solr",
      "customers",
      "city:paris",
      { defType: "lucene" },
      { fq: ["is_active:true", "country:FR"], bq: ["interests:design^10"] }
    );
    expect(proxy).toContain("fq=is_active%3Atrue");
    expect(proxy).toContain("fq=country%3AFR");
    expect(proxy).toContain("bq=interests%3Adesign%5E10");
  });
});
