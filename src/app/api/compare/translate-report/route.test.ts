import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/compare/translate-report/route";

describe("GET /api/compare/translate-report", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("returns available:true when GEMINI_API_KEY is set", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true });
  });

  it("returns available:false when no API key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.COMPARE_AI_API_KEY;
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: false });
  });
});
