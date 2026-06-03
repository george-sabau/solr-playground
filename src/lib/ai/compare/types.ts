import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import type { SelectResponse } from "@/types/solr";

export type AiCompareWinner = "a" | "b" | "tie";
export type AiCompareConfidence = "low" | "medium" | "high";

export interface AiCompareSummary {
  winner: AiCompareWinner;
  confidence: AiCompareConfidence;
  summary: string;
  reasons: string[];
  metricsInterpretation: string[];
  perSideNotes: { a: string; b: string };
  caveats: string[];
}

export interface CompareAiSideInput {
  label: string;
  qSummary: string;
  parser: string;
  response: SelectResponse;
}

export interface CompareAiEvaluateInput {
  searchTerm: string;
  sideA: CompareAiSideInput;
  sideB: CompareAiSideInput;
  metrics: CompareMetricsResult;
}

export interface CompareAiConfig {
  apiKey: string;
  model: string;
}

export interface CompareAiProvider {
  generateJson(systemPrompt: string, userPrompt: string): Promise<string>;
}

export interface CompareAiPayload {
  searchTerm: string;
  sideA: SerializedCompareSide;
  sideB: SerializedCompareSide;
  deterministicMetrics: CompareMetricsResult;
}

export interface SerializedCompareSide {
  label: string;
  qSummary: string;
  parser: string;
  solrResponse: SelectResponse;
}
