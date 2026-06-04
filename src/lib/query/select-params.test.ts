import { describe, expect, it } from "vitest";
import { buildSelectSearchParams } from "@/lib/query/select-params";

describe("buildSelectSearchParams", () => {
  it("appends multiple fq and bq params", () => {
    const params = buildSelectSearchParams(
      "city:paris",
      { defType: "lucene" },
      ["is_active:true", "country:FR"],
      ["interests:design^10", "title:foo^2"]
    );
    expect(params.getAll("fq")).toEqual(["is_active:true", "country:FR"]);
    expect(params.getAll("bq")).toEqual([
      "interests:design^10",
      "title:foo^2",
    ]);
    const qs = params.toString();
    expect(qs.match(/fq=/g)?.length).toBe(2);
    expect(qs.match(/bq=/g)?.length).toBe(2);
  });
});
