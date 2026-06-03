import { afterEach, describe, expect, it } from "vitest";
import {
  isCompareAiAvailable,
  resolveCompareAiApiKey,
  resolveCompareAiConfig,
  resolveCompareAiModel,
} from "@/lib/ai/compare/config";

describe("compare AI config", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("prefers GEMINI_API_KEY over COMPARE_AI_API_KEY", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.COMPARE_AI_API_KEY = "other-key";
    expect(resolveCompareAiApiKey()).toBe("gemini-key");
    expect(isCompareAiAvailable()).toBe(true);
  });

  it("falls back to COMPARE_AI_API_KEY", () => {
    delete process.env.GEMINI_API_KEY;
    process.env.COMPARE_AI_API_KEY = "compare-key";
    expect(resolveCompareAiApiKey()).toBe("compare-key");
  });

  it("returns null config when no key is set", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.COMPARE_AI_API_KEY;
    expect(resolveCompareAiConfig()).toBeNull();
    expect(isCompareAiAvailable()).toBe(false);
  });

  it("uses COMPARE_AI_MODEL or default gemini model", () => {
    process.env.GEMINI_API_KEY = "key";
    delete process.env.COMPARE_AI_MODEL;
    expect(resolveCompareAiModel()).toBe("gemini-2.0-flash");
    process.env.COMPARE_AI_MODEL = "gemini-1.5-pro";
    expect(resolveCompareAiConfig()?.model).toBe("gemini-1.5-pro");
  });
});
