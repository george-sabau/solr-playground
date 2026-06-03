import { describe, expect, it } from "vitest";
import { computeCompareMetrics } from "@/lib/query/compare-metrics";
import type { BuilderState, SearchPlan } from "@/lib/query/types";
import type { SelectResponse } from "@/types/solr";
import {
  buildCompareAiPayload,
  sanitizeSolrDoc,
} from "@/lib/ai/compare/payload";

const emptyBuilder: BuilderState = {
  searchText: "par",
  fields: [],
  combineWith: "OR",
  edismax: { mm: "", min: "", tie: "", qfOverride: "" },
};

const plan: SearchPlan = {
  q: "city:par",
  extra: { defType: "lucene" },
  summary: "city:par",
};

function mockResponse(docs: SelectResponse["response"]["docs"]): SelectResponse {
  return {
    responseHeader: { status: 0, QTime: 2 },
    response: { numFound: docs.length, start: 0, docs, maxScore: 1.2 },
  };
}

describe("sanitizeSolrDoc", () => {
  it("strips internal fields and truncates long strings", () => {
    const long = "x".repeat(600);
    const doc = sanitizeSolrDoc({
      id: "1",
      score: 1.1,
      city: long,
      _version_: 123,
      _text_: "hidden",
    });
    expect(doc._version_).toBeUndefined();
    expect(doc._text_).toBeUndefined();
    expect(doc.city).toHaveLength(500);
    expect(String(doc.city).endsWith("…")).toBe(true);
  });
});

describe("buildCompareAiPayload", () => {
  it("includes full Solr responses and deterministic metrics", () => {
    const responseA = mockResponse([
      { id: "a1", score: 1.2, city: "Paris", email: "a@test.com" },
    ]);
    const responseB = mockResponse([
      { id: "b1", score: 0.9, city: "Austin", email: "b@test.com" },
    ]);
    const metrics = computeCompareMetrics({
      searchTerm: "par",
      labelA: "A",
      labelB: "B",
      planA: plan,
      planB: plan,
      builderA: emptyBuilder,
      builderB: emptyBuilder,
      responseA,
      responseB,
      wallTimeA: 10,
      wallTimeB: 12,
    });

    const payload = buildCompareAiPayload({
      searchTerm: "par",
      sideA: {
        label: "A",
        qSummary: plan.summary,
        parser: "lucene",
        response: responseA,
      },
      sideB: {
        label: "B",
        qSummary: plan.summary,
        parser: "lucene",
        response: responseB,
      },
      metrics,
    });

    expect(payload.searchTerm).toBe("par");
    expect(payload.sideA.solrResponse.response.docs[0]?.city).toBe("Paris");
    expect(payload.sideB.solrResponse.response.docs[0]?.email).toBe("b@test.com");
    expect(payload.deterministicMetrics.overlap.overlapCount).toBe(0);
    expect(JSON.stringify(payload).length).toBeLessThan(90_000);
  });
});
