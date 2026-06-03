import type { CompareAiConfig } from "@/lib/ai/compare/types";

const DEFAULT_MODEL = "gemini-2.0-flash";

export function resolveCompareAiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.COMPARE_AI_API_KEY?.trim() ||
    undefined
  );
}

export function resolveCompareAiModel(): string {
  return process.env.COMPARE_AI_MODEL?.trim() || DEFAULT_MODEL;
}

export function resolveCompareAiConfig(): CompareAiConfig | null {
  const apiKey = resolveCompareAiApiKey();
  if (!apiKey) return null;
  return { apiKey, model: resolveCompareAiModel() };
}

export function isCompareAiAvailable(): boolean {
  return !!resolveCompareAiApiKey();
}
