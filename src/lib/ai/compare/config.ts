import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import type { CompareAiConfig } from "@/lib/ai/compare/types";

const { loadEnvConfig } = nextEnv;

const DEFAULT_MODEL = "gemini-2.5-flash";

let envBootstrapped = false;

function resolveProjectRoot(): string {
  if (process.env.SOLR_PLAYGROUND_ROOT) {
    return process.env.SOLR_PLAYGROUND_ROOT;
  }
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
}

function bootstrapCompareAiEnv(): void {
  if (envBootstrapped || process.env.NODE_ENV === "test") {
    return;
  }
  const { combinedEnv } = loadEnvConfig(resolveProjectRoot(), true);
  for (const [key, value] of Object.entries(combinedEnv)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
  envBootstrapped = true;
}

/** Dynamic key access avoids Turbopack inlining env vars as undefined at compile time. */
function readEnv(key: string): string | undefined {
  bootstrapCompareAiEnv();
  const raw = process.env[key];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveCompareAiApiKey(): string | undefined {
  return readEnv("GEMINI_API_KEY") ?? readEnv("COMPARE_AI_API_KEY");
}

export function resolveCompareAiModel(): string {
  return readEnv("COMPARE_AI_MODEL") ?? DEFAULT_MODEL;
}

export function resolveCompareAiConfig(): CompareAiConfig | null {
  const apiKey = resolveCompareAiApiKey();
  if (!apiKey) return null;
  return { apiKey, model: resolveCompareAiModel() };
}

export function isCompareAiAvailable(): boolean {
  return !!resolveCompareAiApiKey();
}
