import { describe, expect, it } from "vitest";
import {
  buildReportTranslatorInput,
  buildReportTranslatorUserPrompt,
  parseBusinessReportNarrative,
} from "@/lib/ai/compare/report-translator";
import { buildCompareReportPayload } from "@/lib/compare/report-payload";
import { computeCompareMetrics } from "@/lib/query/compare-metrics";
import type { BuilderState, SearchPlan } from "@/lib/query/types";

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
  fq: [],
  bq: [],
  summary: "city:paris",
};

describe("parseBusinessReportNarrative", () => {
  it("parses valid JSON", () => {
    const narrative = parseBusinessReportNarrative(
      JSON.stringify({
        coverSubtitle: "Executive summary",
        coverContext: "Compared two strategies.",
        introductionLead: "We tested two approaches.",
        sourceA: {
          headline: "Paris template",
          description: "Template-based search",
          approachNote: "Saved template",
        },
        sourceB: {
          headline: "Paris URL",
          description: "URL import",
          approachNote: "Imported setup",
        },
        findingsTitle: "Key findings",
        findingsSummary: "Strategy A returned more hits.",
        findingBullets: ["More overlap on A"],
        metricsSectionTitle: "Metrics",
        overlapSectionTitle: "Overlap",
        notesSectionTitle: "Notes",
        recommendation: null,
        aiNotRunMessage: "No AI run.",
        appendixIntro: "Top results.",
        appendixSourceATitle: "A results",
        appendixSourceBTitle: "B results",
      })
    );

    expect(narrative.coverSubtitle).toBe("Executive summary");
    expect(narrative.sourceA.headline).toBe("Paris template");
    expect(narrative.recommendation).toBeNull();
    expect(narrative.findingBullets).toHaveLength(1);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseBusinessReportNarrative("not json")).toThrow(
      /invalid JSON/i
    );
  });
});

describe("buildReportTranslatorUserPrompt", () => {
  it("includes metrics and omits heavy appendix snippets", () => {
    const metrics = computeCompareMetrics({
      searchTerm: "paris",
      labelA: "A",
      labelB: "B",
      planA: plan,
      planB: plan,
      builderA: emptyBuilder,
      builderB: emptyBuilder,
      responseA: {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [{ id: "1", score: 1, city: "Paris" }],
        },
      },
      responseB: null,
      wallTimeA: 10,
      wallTimeB: 0,
    });

    const payload = buildCompareReportPayload({
      core: "customers",
      endpointLabel: "Local",
      sharedSearch: "paris",
      columnA: { builderState: emptyBuilder, importUrl: "", sourceLabel: "A" },
      columnB: { builderState: emptyBuilder, importUrl: "", sourceLabel: "B" },
      planA: plan,
      planB: plan,
      responseA: {
        responseHeader: { status: 0, QTime: 1 },
        response: {
          numFound: 1,
          start: 0,
          docs: [{ id: "1", score: 1 }],
        },
      },
      responseB: null,
      metrics,
      ai: null,
    });

    const input = buildReportTranslatorInput(payload);
    expect(input.metrics).toBeDefined();
    expect((input.appendixA as { id: string }[])[0]?.id).toBe("1");

    const prompt = buildReportTranslatorUserPrompt(payload);
    expect(prompt).toContain("executive-friendly");
    expect(prompt).not.toContain("snippets");
  });
});
