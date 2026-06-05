import type {
  BusinessReportNarrative,
  CompareReportPayload,
} from "@/lib/compare/report-payload";

export type ResolvedReportCopy = {
  isBusiness: boolean;
  coverSubtitle: string;
  coverContext: string;
  introductionTitle: string;
  introductionLead: string;
  sourceATitle: string;
  sourceBTitle: string;
  sourceA: {
    headline: string;
    description: string;
    approachNote: string;
    showTechnicalQueries: boolean;
  };
  sourceB: {
    headline: string;
    description: string;
    approachNote: string;
    showTechnicalQueries: boolean;
  };
  metricsSectionTitle: string;
  overlapSectionTitle: string;
  notesSectionTitle: string;
  findingBullets: string[] | null;
  findingsSummary: string | null;
  aiSectionTitle: string;
  aiNotRunMessage: string;
  recommendation: BusinessReportNarrative["recommendation"];
  appendixTitle: string;
  appendixIntro: string;
  appendixSourceATitle: string;
  appendixSourceBTitle: string;
};

export function resolveReportCopy(
  payload: CompareReportPayload
): ResolvedReportCopy {
  const isBusiness =
    payload.audience === "business" && payload.business != null;
  const b = payload.business;

  if (!isBusiness || !b) {
    return {
      isBusiness: false,
      coverSubtitle: "Search comparison evaluation report",
      coverContext: `Comparison of ${payload.sourceA.label} vs ${payload.sourceB.label} on core ${payload.core} using endpoint ${payload.endpointLabel}.`,
      introductionTitle: "Introduction",
      introductionLead:
        "This report compares two Solr query setups (Source A and Source B) executed against the same core with an identical shared search term. Source A and Source B may differ in field selection, filters, boosts, and parser settings.",
      sourceATitle: "Source A",
      sourceBTitle: "Source B",
      sourceA: {
        headline: payload.sourceA.label,
        description: "",
        approachNote: payload.sourceA.strategyNote,
        showTechnicalQueries: true,
      },
      sourceB: {
        headline: payload.sourceB.label,
        description: "",
        approachNote: payload.sourceB.strategyNote,
        showTechnicalQueries: true,
      },
      metricsSectionTitle: "Technical comparison summary",
      overlapSectionTitle: "Overlap and heuristics",
      notesSectionTitle: "Notes",
      findingBullets: null,
      findingsSummary: null,
      aiSectionTitle: "AI-generated summary",
      aiNotRunMessage:
        "AI evaluation was not performed for this comparison. Run Evaluate relevance (AI) on the Compare tab before exporting to include an AI verdict and narrative.",
      recommendation: null,
      appendixTitle: "Appendix — research results",
      appendixIntro:
        "Top 10 documents per side (collapsed: rank, document id, score, and a short field snippet where available).",
      appendixSourceATitle: "Source A — top results",
      appendixSourceBTitle: "Source B — top results",
    };
  }

  return {
    isBusiness: true,
    coverSubtitle: b.coverSubtitle,
    coverContext: b.coverContext,
    introductionTitle: "Introduction",
    introductionLead: b.introductionLead,
    sourceATitle: b.sourceA.headline,
    sourceBTitle: b.sourceB.headline,
    sourceA: {
      headline: b.sourceA.headline,
      description: b.sourceA.description,
      approachNote: b.sourceA.approachNote,
      showTechnicalQueries: false,
    },
    sourceB: {
      headline: b.sourceB.headline,
      description: b.sourceB.description,
      approachNote: b.sourceB.approachNote,
      showTechnicalQueries: false,
    },
    metricsSectionTitle: b.metricsSectionTitle,
    overlapSectionTitle: b.overlapSectionTitle,
    notesSectionTitle: b.notesSectionTitle,
    findingBullets: b.findingBullets,
    findingsSummary: b.findingsSummary,
    aiSectionTitle: b.recommendation ? "Recommendation" : "AI evaluation",
    aiNotRunMessage: b.aiNotRunMessage,
    recommendation: b.recommendation,
    appendixTitle: "Appendix",
    appendixIntro: b.appendixIntro,
    appendixSourceATitle: b.appendixSourceATitle,
    appendixSourceBTitle: b.appendixSourceBTitle,
  };
}
