export {
  isCompareAiAvailable,
  resolveCompareAiApiKey,
  resolveCompareAiConfig,
  resolveCompareAiModel,
} from "@/lib/ai/compare/config";
export {
  CompareAiNotConfiguredError,
  evaluateCompare,
  parseCompareAiSummary,
} from "@/lib/ai/compare/evaluator";
export { buildCompareAiPayload, sanitizeSolrDoc } from "@/lib/ai/compare/payload";
export type {
  AiCompareSummary,
  CompareAiEvaluateInput,
  CompareAiProvider,
} from "@/lib/ai/compare/types";
