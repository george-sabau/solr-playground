import { resolveCompareAiConfig } from "@/lib/ai/compare/config";
import { createGeminiProvider } from "@/lib/ai/compare/gemini-provider";
import { buildCompareAiPayload } from "@/lib/ai/compare/payload";
import {
  COMPARE_AI_SYSTEM_PROMPT,
  buildCompareAiUserPrompt,
} from "@/lib/ai/compare/prompt";
import type {
  AiCompareConfidence,
  AiCompareSummary,
  AiCompareWinner,
  CompareAiEvaluateInput,
  CompareAiProvider,
} from "@/lib/ai/compare/types";

export class CompareAiNotConfiguredError extends Error {
  constructor() {
    super(
      "AI evaluation is not configured. Set GEMINI_API_KEY in .env.local on the server."
    );
    this.name = "CompareAiNotConfiguredError";
  }
}

function asWinner(value: unknown): AiCompareWinner {
  return value === "a" || value === "b" || value === "tie" ? value : "tie";
}

function asConfidence(value: unknown): AiCompareConfidence {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function parseCompareAiSummary(raw: string): AiCompareSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned an unexpected response shape.");
  }

  const obj = parsed as Record<string, unknown>;
  const perSide =
    obj.perSideNotes && typeof obj.perSideNotes === "object"
      ? (obj.perSideNotes as Record<string, unknown>)
      : {};

  return {
    winner: asWinner(obj.winner),
    confidence: asConfidence(obj.confidence),
    summary: typeof obj.summary === "string" ? obj.summary : "",
    reasons: asStringArray(obj.reasons),
    metricsInterpretation: asStringArray(obj.metricsInterpretation),
    perSideNotes: {
      a: typeof perSide.a === "string" ? perSide.a : "",
      b: typeof perSide.b === "string" ? perSide.b : "",
    },
    caveats: asStringArray(obj.caveats),
  };
}

export async function evaluateCompare(
  input: CompareAiEvaluateInput,
  provider?: CompareAiProvider
): Promise<AiCompareSummary> {
  const config = resolveCompareAiConfig();
  if (!config && !provider) {
    throw new CompareAiNotConfiguredError();
  }

  if (!input.sideA.response.response.docs.length || !input.sideB.response.response.docs.length) {
    throw new Error("Both sides need result documents to evaluate.");
  }

  const payload = buildCompareAiPayload(input);
  const userPrompt = buildCompareAiUserPrompt(payload);
  const aiProvider = provider ?? createGeminiProvider(config!);
  const raw = await aiProvider.generateJson(COMPARE_AI_SYSTEM_PROMPT, userPrompt);
  return parseCompareAiSummary(raw);
}
