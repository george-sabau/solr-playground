import type { AiCompareSummary } from "@/lib/ai/compare/types";
import {
  toSlimCompareDocs,
  type SlimCompareDoc,
} from "@/lib/query/compare-slim-doc";
import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import type { BuilderState, SearchPlan } from "@/lib/query/types";
import type { SelectResponse } from "@/types/solr";

export const COMPARE_REPORT_STORAGE_KEY = "solr-playground:compare-report";
export const COMPARE_REPORT_PRODUCT_NAME = "Solr Playground";
/** Practical localStorage limit guard (bytes). */
export const COMPARE_REPORT_MAX_BYTES = 4_500_000;

export type ReportAudience = "technical" | "business";

export type BusinessReportSourceNarrative = {
  headline: string;
  description: string;
  approachNote: string;
};

export type BusinessReportRecommendation = {
  headline: string;
  confidenceLabel: string;
  summary: string;
  reasons: string[];
  sideANote: string;
  sideBNote: string;
  caveats: string[];
};

export type BusinessReportNarrative = {
  coverSubtitle: string;
  coverContext: string;
  introductionLead: string;
  sourceA: BusinessReportSourceNarrative;
  sourceB: BusinessReportSourceNarrative;
  findingsTitle: string;
  findingsSummary: string;
  findingBullets: string[];
  metricsSectionTitle: string;
  overlapSectionTitle: string;
  notesSectionTitle: string;
  recommendation: BusinessReportRecommendation | null;
  aiNotRunMessage: string;
  appendixIntro: string;
  appendixSourceATitle: string;
  appendixSourceBTitle: string;
};

function reportStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export type CompareReportSourceSide = {
  label: string;
  planSummary: string;
  q: string;
  fq: string[];
  bq: string[];
  strategyNote: string;
};

export type CompareReportPayload = {
  version: 2;
  audience: ReportAudience;
  business: BusinessReportNarrative | null;
  generatedAt: string;
  productName: string;
  endpointLabel: string;
  core: string;
  sharedSearch: string;
  sourceA: CompareReportSourceSide;
  sourceB: CompareReportSourceSide;
  metrics: CompareMetricsResult;
  ai: AiCompareSummary | null;
  appendixA: SlimCompareDoc[];
  appendixB: SlimCompareDoc[];
};

export type CompareReportColumnInput = {
  importUrl: string;
  sourceLabel: string | null;
  builderState: BuilderState;
};

function buildSourceSide(
  column: CompareReportColumnInput,
  plan: SearchPlan
): CompareReportSourceSide {
  const strategyNote = column.importUrl.trim()
    ? "Loaded from Solr URL"
    : "Loaded from saved template";
  return {
    label: column.sourceLabel ?? "Query setup",
    planSummary: plan.summary,
    q: plan.q,
    fq: [...plan.fq],
    bq: [...plan.bq],
    strategyNote,
  };
}

function fieldOrderFromBuilder(column: CompareReportColumnInput): string[] {
  return column.builderState.fields.map((f) => f.field);
}

export function buildCompareReportPayload(input: {
  core: string;
  endpointLabel: string;
  sharedSearch: string;
  columnA: CompareReportColumnInput;
  columnB: CompareReportColumnInput;
  planA: SearchPlan;
  planB: SearchPlan;
  responseA: SelectResponse | null;
  responseB: SelectResponse | null;
  metrics: CompareMetricsResult;
  ai: AiCompareSummary | null;
  audience?: ReportAudience;
  business?: BusinessReportNarrative | null;
}): CompareReportPayload {
  const docsA = input.responseA?.response.docs ?? [];
  const docsB = input.responseB?.response.docs ?? [];
  const audience = input.audience ?? "technical";

  return {
    version: 2,
    audience,
    business: audience === "business" ? (input.business ?? null) : null,
    generatedAt: new Date().toISOString(),
    productName: COMPARE_REPORT_PRODUCT_NAME,
    endpointLabel: input.endpointLabel,
    core: input.core,
    sharedSearch: input.sharedSearch,
    sourceA: buildSourceSide(input.columnA, input.planA),
    sourceB: buildSourceSide(input.columnB, input.planB),
    metrics: input.metrics,
    ai: input.ai,
    appendixA: toSlimCompareDocs(docsA, fieldOrderFromBuilder(input.columnA)),
    appendixB: toSlimCompareDocs(docsB, fieldOrderFromBuilder(input.columnB)),
  };
}

/** Strip snippet text to shrink payload for storage. */
export function stripAppendixSnippets(
  payload: CompareReportPayload
): CompareReportPayload {
  const strip = (docs: SlimCompareDoc[]) =>
    docs.map((d) => ({ rank: d.rank, id: d.id, score: d.score, snippets: {} }));
  return {
    ...payload,
    appendixA: strip(payload.appendixA),
    appendixB: strip(payload.appendixB),
  };
}

export function serializeCompareReportPayload(
  payload: CompareReportPayload
): { ok: true } | { ok: false; reason: string } {
  let data = payload;
  let json = JSON.stringify(data);
  if (json.length > COMPARE_REPORT_MAX_BYTES) {
    data = stripAppendixSnippets(payload);
    json = JSON.stringify(data);
  }
  if (json.length > COMPARE_REPORT_MAX_BYTES) {
    return {
      ok: false,
      reason: "Report data is too large to export. Try a smaller result set.",
    };
  }
  const storage = reportStorage();
  if (!storage) {
    return {
      ok: false,
      reason: "Browser storage is not available.",
    };
  }
  try {
    storage.setItem(COMPARE_REPORT_STORAGE_KEY, json);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "Could not store report data in the browser.",
    };
  }
}

export function clearCompareReportStorage(): void {
  const storage = reportStorage();
  if (!storage) return;
  storage.removeItem(COMPARE_REPORT_STORAGE_KEY);
}

type LegacyReportPayloadV1 = Omit<
  CompareReportPayload,
  "version" | "audience" | "business"
> & { version: 1 };

function normalizeReportPayload(
  data: LegacyReportPayloadV1 | CompareReportPayload
): CompareReportPayload | null {
  if (!data.metrics?.sideA || !data.metrics?.sideB) return null;
  if (!data.sourceA || !data.sourceB) return null;

  if (data.version === 1) {
    return {
      ...data,
      version: 2,
      audience: "technical",
      business: null,
    };
  }

  if (data.version !== 2) return null;

  const v2 = data as CompareReportPayload;
  if (v2.audience === "business" && !v2.business) return null;

  return v2;
}

export function parseCompareReportPayload(
  raw: string | null
): CompareReportPayload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as LegacyReportPayloadV1 | CompareReportPayload;
    if (data?.version !== 1 && data?.version !== 2) return null;
    return normalizeReportPayload(data);
  } catch {
    return null;
  }
}

/**
 * Reads export payload written by the Compare tab.
 * Uses localStorage so data is visible in a new tab (sessionStorage is per-tab).
 */
export function readCompareReportFromStorage(): CompareReportPayload | null {
  const storage = reportStorage();
  if (!storage) return null;
  const raw = storage.getItem(COMPARE_REPORT_STORAGE_KEY);
  const parsed = parseCompareReportPayload(raw);
  if (parsed) return parsed;
  if (typeof sessionStorage !== "undefined") {
    return parseCompareReportPayload(
      sessionStorage.getItem(COMPARE_REPORT_STORAGE_KEY)
    );
  }
  return null;
}

/** @deprecated Use readCompareReportFromStorage */
export function readCompareReportFromSession(): CompareReportPayload | null {
  return readCompareReportFromStorage();
}

export function compareReportFilename(
  generatedAt: string,
  audience: ReportAudience = "technical"
): string {
  const d = generatedAt.slice(0, 10);
  const prefix =
    audience === "business" ? "compare-report-business" : "compare-report";
  return `${prefix}-${d}.pdf`;
}
