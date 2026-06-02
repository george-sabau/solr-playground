import type { AnalysisStage, AnalysisToken } from "@/types/solr";

function coerceTokens(raw: unknown): AnalysisToken[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((item): AnalysisToken => {
      if (item != null && typeof item === "object" && "text" in item) {
        return item as AnalysisToken;
      }
      return { text: String(item) };
    });
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.records)) return coerceTokens(o.records);
    if (Array.isArray(o.tokens)) return coerceTokens(o.tokens);
    if (typeof o.text === "string") {
      return [{ ...(o as unknown as AnalysisToken), text: o.text }];
    }
  }
  if (typeof raw === "string") return [{ text: raw }];
  return [];
}

/**
 * Solr `/analysis/field` index stages are usually `[stageName, Token[]]`, but some
 * versions / paths return a single token object or a wrapper object instead of an array.
 */
export function normalizeIndexStages(raw: unknown): AnalysisStage[] {
  if (!Array.isArray(raw)) return [];
  const out: AnalysisStage[] = [];
  for (const stage of raw) {
    if (!Array.isArray(stage) || stage.length < 2) continue;
    const name = String(stage[0] ?? "");
    const tokens = coerceTokens(stage[1]);
    out.push([name, tokens]);
  }
  return out;
}

export function lastNonEmptyStage(stages: AnalysisStage[] | null): AnalysisStage | null {
  if (!stages || stages.length === 0) return null;
  for (let i = stages.length - 1; i >= 0; i--) {
    const [, tokens] = stages[i];
    if (tokens.length > 0) return stages[i];
  }
  const last = stages[stages.length - 1];
  return last ?? null;
}
