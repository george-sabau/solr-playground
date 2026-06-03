import { describe, expect, it } from "vitest";
import { computeCompareMetrics } from "@/lib/query/compare-metrics";
import type { BuilderState, SearchPlan } from "@/lib/query/types";
import type { SelectResponse } from "@/types/solr";
import {
  CompareAiNotConfiguredError,
  evaluateCompare,
  parseCompareAiSummary,
} from "@/lib/ai/compare/evaluator";
import type { CompareAiProvider } from "@/lib/ai/compare/types";

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

function mockResponse(id: string): SelectResponse {
  return {
    responseHeader: { status: 0, QTime: 1 },
    response: {
      numFound: 1,
      start: 0,
      docs: [{ id, score: 1, city: "Paris" }],
    },
  };
}

describe("parseCompareAiSummary", () => {
  it("parses and normalizes valid JSON", () => {
    const summary = parseCompareAiSummary(
      JSON.stringify({
        winner: "a",
        confidence: "high",
        summary: "Source A matches Paris better.",
        reasons: ["City field match"],
        metricsInterpretation: ["Zero overlap suggests different recall."],
        perSideNotes: { a: "Strong city hits", b: "Weaker matches" },
        caveats: ["Only top 10 evaluated"],
      })
    );
    expect(summary.winner).toBe("a");
    expect(summary.confidence).toBe("high");
    expect(summary.summary).toContain("Paris");
    expect(summary.metricsInterpretation).toHaveLength(1);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseCompareAiSummary("not-json")).toThrow(/invalid JSON/i);
  });
});

describe("evaluateCompare", () => {
  const metrics = computeCompareMetrics({
    searchTerm: "par",
    labelA: "A",
    labelB: "B",
    planA: plan,
    planB: plan,
    builderA: emptyBuilder,
    builderB: emptyBuilder,
    responseA: mockResponse("a1"),
    responseB: mockResponse("b1"),
    wallTimeA: 5,
    wallTimeB: 6,
  });

  const mockProvider: CompareAiProvider = {
    generateJson: async () =>
      JSON.stringify({
        winner: "b",
        confidence: "medium",
        summary: "B wins overall.",
        reasons: ["Better keyword fit"],
        metricsInterpretation: ["Similar QTime"],
        perSideNotes: { a: "OK", b: "Better" },
        caveats: [],
      }),
  };

  it("uses injected provider without env key", async () => {
    const result = await evaluateCompare(
      {
        searchTerm: "par",
        sideA: {
          label: "A",
          qSummary: plan.summary,
          parser: "lucene",
          response: mockResponse("a1"),
        },
        sideB: {
          label: "B",
          qSummary: plan.summary,
          parser: "lucene",
          response: mockResponse("b1"),
        },
        metrics,
      },
      mockProvider
    );
    expect(result.winner).toBe("b");
    expect(result.summary).toBe("B wins overall.");
  });

  it("throws when docs are missing and no provider bypasses config", async () => {
    await expect(
      evaluateCompare(
        {
          searchTerm: "par",
          sideA: {
            label: "A",
            qSummary: plan.summary,
            parser: "lucene",
            response: { responseHeader: { status: 0, QTime: 0 }, response: { numFound: 0, start: 0, docs: [] } },
          },
          sideB: {
            label: "B",
            qSummary: plan.summary,
            parser: "lucene",
            response: mockResponse("b1"),
          },
          metrics,
        },
        mockProvider
      )
    ).rejects.toThrow(/both sides need result documents/i);
  });

  it("throws CompareAiNotConfiguredError without key or provider", async () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevCompare = process.env.COMPARE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.COMPARE_AI_API_KEY;

    await expect(
      evaluateCompare({
        searchTerm: "par",
        sideA: {
          label: "A",
          qSummary: plan.summary,
          parser: "lucene",
          response: mockResponse("a1"),
        },
        sideB: {
          label: "B",
          qSummary: plan.summary,
          parser: "lucene",
          response: mockResponse("b1"),
        },
        metrics,
      })
    ).rejects.toBeInstanceOf(CompareAiNotConfiguredError);

    process.env.GEMINI_API_KEY = prevGemini;
    process.env.COMPARE_AI_API_KEY = prevCompare;
  });
});
