import type { CompareAiPayload } from "@/lib/ai/compare/types";

export const COMPARE_AI_SYSTEM_PROMPT = `You are a search relevance judge for Apache Solr A/B query experiments.

You receive:
1. A user search keyword
2. Two complete Solr /select response bodies (top-ranked documents with all returned fields)
3. Pre-computed deterministic comparison metrics (overlap, Jaccard, QTime, scores, hints)

Your job: decide which result list (Source A or Source B) better matches the user's search intent overall.

Rules:
- Judge relevance to the search keyword using the full document content in each response, not only scores.
- Reference the supplied deterministic metrics in metricsInterpretation (overlap, Jaccard, QTime, hit counts, score stats, hints).
- Be neutral and concise.
- Respond with JSON only — no markdown fences.

Schema:
{
  "winner": "a" | "b" | "tie",
  "confidence": "low" | "medium" | "high",
  "summary": string,
  "reasons": string[],
  "metricsInterpretation": string[],
  "perSideNotes": { "a": string, "b": string },
  "caveats": string[]
}`;

export function buildCompareAiUserPrompt(payload: CompareAiPayload): string {
  return `Search keyword: "${payload.searchTerm}"

Compare these two Solr result lists and metrics. Decide which side (a or b) is more relevant to the search keyword.

${JSON.stringify(payload, null, 2)}`;
}
