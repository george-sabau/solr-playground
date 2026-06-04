import { describe, expect, it } from "vitest";
import {
  buildCompareReportPayload,
  parseCompareReportPayload,
  stripAppendixSnippets,
  type CompareReportColumnInput,
} from "@/lib/compare/report-payload";
import { computeCompareMetrics } from "@/lib/query/compare-metrics";
import type { BuilderState, SearchPlan } from "@/lib/query/types";
import type { SelectResponse } from "@/types/solr";

const emptyBuilder: BuilderState = {
  searchText: "paris",
  fields: [{ id: "f1", field: "city", matchers: [] }],
  combineWith: "OR",
  edismax: { mm: "", min: "", tie: "", qfOverride: "" },
  filterQueries: [],
  boostQueries: [],
};

const plan: SearchPlan = {
  q: "city:paris",
  extra: { defType: "lucene" },
  fq: ["country:FR"],
  bq: ["popularity:10^2"],
  summary: "city:paris",
};

function column(label: string, importUrl = ""): CompareReportColumnInput {
  return {
    builderState: emptyBuilder,
    importUrl,
    sourceLabel: label,
  };
}

function mockResponse(docs: { id: string; score: number }[]): SelectResponse {
  return {
    responseHeader: { status: 0, QTime: 2 },
    response: {
      numFound: docs.length,
      start: 0,
      docs: docs.map((d) => ({ id: d.id, score: d.score, city: "Paris" })),
      maxScore: docs[0]?.score ?? null,
    },
  };
}

describe("buildCompareReportPayload", () => {
  it("builds payload with metrics, appendix, and strategy notes", () => {
    const responseA = mockResponse([{ id: "1", score: 2 }]);
    const responseB = mockResponse([{ id: "1", score: 1.5 }]);
    const metrics = computeCompareMetrics({
      searchTerm: "paris",
      labelA: "Template A",
      labelB: "Template B",
      planA: plan,
      planB: plan,
      builderA: emptyBuilder,
      builderB: emptyBuilder,
      responseA,
      responseB,
      wallTimeA: 40,
      wallTimeB: 55,
    });

    const payload = buildCompareReportPayload({
      core: "customers",
      endpointLabel: "Local Solr",
      sharedSearch: "paris",
      columnA: column("Template A"),
      columnB: column("Template B", "http://localhost:8983/solr/customers/select"),
      planA: plan,
      planB: plan,
      responseA,
      responseB,
      metrics,
      ai: null,
    });

    expect(payload.version).toBe(1);
    expect(payload.productName).toBe("Solr Playground");
    expect(payload.sourceA.strategyNote).toBe("Loaded from saved template");
    expect(payload.sourceB.strategyNote).toBe("Loaded from Solr URL");
    expect(payload.appendixA).toHaveLength(1);
    expect(payload.appendixA[0]?.id).toBe("1");
    expect(payload.metrics.overlap.overlapCount).toBe(1);
    expect(payload.ai).toBeNull();
  });

  it("includes AI summary when provided", () => {
    const metrics = computeCompareMetrics({
      searchTerm: "x",
      labelA: "A",
      labelB: "B",
      planA: plan,
      planB: plan,
      builderA: emptyBuilder,
      builderB: emptyBuilder,
      responseA: mockResponse([{ id: "1", score: 1 }]),
      responseB: mockResponse([{ id: "2", score: 1 }]),
      wallTimeA: 1,
      wallTimeB: 1,
    });

    const ai = {
      winner: "a" as const,
      confidence: "high" as const,
      summary: "A wins",
      reasons: ["better scores"],
      metricsInterpretation: ["overlap low"],
      perSideNotes: { a: "good", b: "weak" },
      caveats: ["top 10 only"],
    };

    const payload = buildCompareReportPayload({
      core: "c",
      endpointLabel: "ep",
      sharedSearch: "x",
      columnA: column("A"),
      columnB: column("B"),
      planA: plan,
      planB: plan,
      responseA: mockResponse([{ id: "1", score: 1 }]),
      responseB: mockResponse([{ id: "2", score: 1 }]),
      metrics,
      ai,
    });

    expect(payload.ai?.winner).toBe("a");
    expect(payload.ai?.summary).toBe("A wins");
  });
});

describe("parseCompareReportPayload", () => {
  it("round-trips valid JSON", () => {
    const metrics = computeCompareMetrics({
      searchTerm: "q",
      labelA: "A",
      labelB: "B",
      planA: plan,
      planB: plan,
      builderA: emptyBuilder,
      builderB: emptyBuilder,
      responseA: null,
      responseB: null,
      wallTimeA: 0,
      wallTimeB: 0,
    });
    const payload = buildCompareReportPayload({
      core: "c",
      endpointLabel: "e",
      sharedSearch: "q",
      columnA: column("A"),
      columnB: column("B"),
      planA: plan,
      planB: plan,
      responseA: null,
      responseB: null,
      metrics,
      ai: null,
    });
    const parsed = parseCompareReportPayload(JSON.stringify(payload));
    expect(parsed?.core).toBe("c");
    expect(parsed?.version).toBe(1);
  });

  it("rejects invalid payloads", () => {
    expect(parseCompareReportPayload(null)).toBeNull();
    expect(parseCompareReportPayload("{}")).toBeNull();
  });
});

describe("stripAppendixSnippets", () => {
  it("removes snippet fields", () => {
    const metrics = computeCompareMetrics({
      searchTerm: "q",
      labelA: "A",
      labelB: "B",
      planA: plan,
      planB: plan,
      builderA: emptyBuilder,
      builderB: emptyBuilder,
      responseA: mockResponse([{ id: "1", score: 1 }]),
      responseB: null,
      wallTimeA: 0,
      wallTimeB: 0,
    });
    const payload = buildCompareReportPayload({
      core: "c",
      endpointLabel: "e",
      sharedSearch: "q",
      columnA: column("A"),
      columnB: column("B"),
      planA: plan,
      planB: plan,
      responseA: mockResponse([{ id: "1", score: 1 }]),
      responseB: null,
      metrics,
      ai: null,
    });
    expect(payload.appendixA[0]?.snippets.city).toBeDefined();
    const stripped = stripAppendixSnippets(payload);
    expect(stripped.appendixA[0]?.snippets).toEqual({});
  });
});
