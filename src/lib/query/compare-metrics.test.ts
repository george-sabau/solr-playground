import { describe, expect, it } from "vitest";
import { computeCompareMetrics } from "@/lib/query/compare-metrics";
import type { BuilderState, SearchPlan } from "@/lib/query/types";
import type { SelectResponse } from "@/types/solr";

const emptyBuilder: BuilderState = {
  searchText: "smith",
  fields: [],
  combineWith: "OR",
  edismax: { mm: "", min: "", tie: "", qfOverride: "" },
  filterQueries: [],
  boostQueries: [],
};

const plan: SearchPlan = {
  q: "name:smith",
  extra: { defType: "lucene" },
  fq: [],
  bq: [],
  summary: "name:smith",
};

function mockResponse(
  docs: { id: string; score: number }[],
  numFound: number
): SelectResponse {
  return {
    responseHeader: { status: 0, QTime: 1 },
    response: {
      numFound,
      start: 0,
      docs: docs.map((d) => ({ id: d.id, score: d.score })),
      maxScore: docs[0]?.score ?? null,
    },
  };
}

describe("computeCompareMetrics", () => {
  it("computes overlap and side metrics for two result sets", () => {
    const result = computeCompareMetrics({
      searchTerm: "smith",
      labelA: "A",
      labelB: "B",
      planA: plan,
      planB: plan,
      builderA: emptyBuilder,
      builderB: emptyBuilder,
      responseA: mockResponse(
        [
          { id: "1", score: 2.0 },
          { id: "2", score: 1.5 },
        ],
        100
      ),
      responseB: mockResponse(
        [
          { id: "1", score: 1.8 },
          { id: "3", score: 1.2 },
        ],
        80
      ),
      wallTimeA: 50,
      wallTimeB: 60,
    });

    expect(result.sideA.numFound).toBe(100);
    expect(result.sideB.numFound).toBe(80);
    expect(result.overlap.overlapCount).toBe(1);
    expect(result.overlap.onlyInA).toBe(1);
    expect(result.overlap.onlyInB).toBe(1);
    expect(result.hints.length).toBeGreaterThan(0);
  });
});
