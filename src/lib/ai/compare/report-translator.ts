import { resolveCompareAiConfig } from "@/lib/ai/compare/config";
import { CompareAiNotConfiguredError } from "@/lib/ai/compare/evaluator";
import { createGeminiProvider } from "@/lib/ai/compare/gemini-provider";
import type {
  BusinessReportNarrative,
  BusinessReportRecommendation,
  BusinessReportSourceNarrative,
  CompareReportPayload,
} from "@/lib/compare/report-payload";
import type { CompareAiProvider } from "@/lib/ai/compare/types";

export const REPORT_TRANSLATOR_SYSTEM_PROMPT = `You translate Solr search comparison report data into executive-friendly language for business leaders.

Input: structured comparison data (two query strategies, metrics, optional AI evaluation, top result ids).

Output: JSON only — no markdown. Match this schema exactly:

{
  "coverSubtitle": string,
  "coverContext": string,
  "introductionLead": string,
  "sourceA": { "headline": string, "description": string, "approachNote": string },
  "sourceB": { "headline": string, "description": string, "approachNote": string },
  "findingsTitle": string,
  "findingsSummary": string,
  "findingBullets": string[],
  "metricsSectionTitle": string,
  "overlapSectionTitle": string,
  "notesSectionTitle": string,
  "recommendation": {
    "headline": string,
    "confidenceLabel": string,
    "summary": string,
    "reasons": string[],
    "sideANote": string,
    "sideBNote": string,
    "caveats": string[]
  } | null,
  "aiNotRunMessage": string,
  "appendixIntro": string,
  "appendixSourceATitle": string,
  "appendixSourceBTitle": string
}

Rules:
- Avoid Solr jargon (no fq, bq, Jaccard, QTime, defType). Use plain business language.
- Preserve factual numbers from metrics (hit counts, overlap counts, percentages).
- Use source labels from input, not "Source A/B" alone, when names are available.
- If ai evaluation is present in input, fill recommendation from it (plain language). If absent, set recommendation to null and write a helpful aiNotRunMessage.
- findingBullets: 3–6 executive takeaways from hints and overlap.
- Keep tone neutral, concise, suitable for a PDF report.`;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function parseSourceNarrative(value: unknown): BusinessReportSourceNarrative {
  const obj =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    headline: asString(obj.headline, "Query strategy"),
    description: asString(obj.description),
    approachNote: asString(obj.approachNote),
  };
}

function parseRecommendation(
  value: unknown
): BusinessReportRecommendation | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  return {
    headline: asString(obj.headline, "Recommendation"),
    confidenceLabel: asString(obj.confidenceLabel, "medium"),
    summary: asString(obj.summary),
    reasons: asStringArray(obj.reasons),
    sideANote: asString(obj.sideANote),
    sideBNote: asString(obj.sideBNote),
    caveats: asStringArray(obj.caveats),
  };
}

export function parseBusinessReportNarrative(
  raw: string
): BusinessReportNarrative {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON for business report.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned an unexpected business report shape.");
  }

  const obj = parsed as Record<string, unknown>;

  return {
    coverSubtitle: asString(
      obj.coverSubtitle,
      "Search strategy comparison — executive summary"
    ),
    coverContext: asString(obj.coverContext),
    introductionLead: asString(obj.introductionLead),
    sourceA: parseSourceNarrative(obj.sourceA),
    sourceB: parseSourceNarrative(obj.sourceB),
    findingsTitle: asString(obj.findingsTitle, "Key findings"),
    findingsSummary: asString(obj.findingsSummary),
    findingBullets: asStringArray(obj.findingBullets),
    metricsSectionTitle: asString(
      obj.metricsSectionTitle,
      "Performance comparison"
    ),
    overlapSectionTitle: asString(
      obj.overlapSectionTitle,
      "Result overlap"
    ),
    notesSectionTitle: asString(obj.notesSectionTitle, "Additional notes"),
    recommendation: parseRecommendation(obj.recommendation),
    aiNotRunMessage: asString(
      obj.aiNotRunMessage,
      "Automated relevance evaluation was not performed for this comparison."
    ),
    appendixIntro: asString(
      obj.appendixIntro,
      "Top search results for each strategy (reference)."
    ),
    appendixSourceATitle: asString(obj.appendixSourceATitle, "Strategy A — top results"),
    appendixSourceBTitle: asString(obj.appendixSourceBTitle, "Strategy B — top results"),
  };
}

export function buildReportTranslatorInput(
  payload: CompareReportPayload
): Record<string, unknown> {
  return {
    productName: payload.productName,
    core: payload.core,
    endpointLabel: payload.endpointLabel,
    sharedSearch: payload.sharedSearch,
    sourceA: {
      label: payload.sourceA.label,
      strategyNote: payload.sourceA.strategyNote,
      fieldCount: payload.metrics.sideA.selectedFieldCount,
    },
    sourceB: {
      label: payload.sourceB.label,
      strategyNote: payload.sourceB.strategyNote,
      fieldCount: payload.metrics.sideB.selectedFieldCount,
    },
    metrics: {
      sideA: {
        label: payload.metrics.sideA.label,
        numFound: payload.metrics.sideA.numFound,
        qTime: payload.metrics.sideA.qTime,
        wallTimeMs: payload.metrics.sideA.wallTimeMs,
        maxScore: payload.metrics.sideA.maxScore,
        avgScoreTop10: payload.metrics.sideA.avgScoreTop10,
      },
      sideB: {
        label: payload.metrics.sideB.label,
        numFound: payload.metrics.sideB.numFound,
        qTime: payload.metrics.sideB.qTime,
        wallTimeMs: payload.metrics.sideB.wallTimeMs,
        maxScore: payload.metrics.sideB.maxScore,
        avgScoreTop10: payload.metrics.sideB.avgScoreTop10,
      },
      overlap: payload.metrics.overlap,
      heuristics: payload.metrics.heuristics,
      hints: payload.metrics.hints,
    },
    aiEvaluation: payload.ai,
    appendixA: payload.appendixA.map((d) => ({
      rank: d.rank,
      id: d.id,
      score: d.score,
    })),
    appendixB: payload.appendixB.map((d) => ({
      rank: d.rank,
      id: d.id,
      score: d.score,
    })),
  };
}

export function buildReportTranslatorUserPrompt(
  payload: CompareReportPayload
): string {
  return `Translate this Solr comparison report data into executive-friendly JSON for a business audience PDF.

${JSON.stringify(buildReportTranslatorInput(payload), null, 2)}`;
}

export async function translateReportToBusiness(
  payload: CompareReportPayload,
  provider?: CompareAiProvider
): Promise<BusinessReportNarrative> {
  const config = resolveCompareAiConfig();
  if (!config && !provider) {
    throw new CompareAiNotConfiguredError();
  }

  const ai = provider ?? createGeminiProvider(config!);
  const raw = await ai.generateJson(
    REPORT_TRANSLATOR_SYSTEM_PROMPT,
    buildReportTranslatorUserPrompt(payload)
  );
  return parseBusinessReportNarrative(raw);
}
