import { describe, expect, it } from "vitest";
import { compileFieldsToQ, escapeLuceneTerm } from "@/lib/query/compile";
import { createFieldConfig } from "@/lib/query/types";

describe("escapeLuceneTerm", () => {
  it("escapes Lucene special characters", () => {
    expect(escapeLuceneTerm("foo+bar")).toBe("foo\\+bar");
    expect(escapeLuceneTerm('a"b')).toBe('a\\"b');
  });
});

describe("compileFieldsToQ", () => {
  it("returns *:* when search text is empty", () => {
    expect(
      compileFieldsToQ([createFieldConfig("name")], "", { combineWith: "AND" })
    ).toBe("*:*");
  });

  it("compiles a single field term query", () => {
    const q = compileFieldsToQ(
      [createFieldConfig("name")],
      "smith",
      { combineWith: "AND" }
    );
    expect(q).toBe("name:smith");
  });
});
