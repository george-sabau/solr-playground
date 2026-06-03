import { describe, expect, it } from "vitest";
import { formatDbError } from "@/lib/persistence/db-errors";

describe("formatDbError", () => {
  it("maps NODE_MODULE_VERSION mismatch to rebuild instructions", () => {
    const msg = formatDbError(
      new Error(
        "The module was compiled against a different Node.js version using NODE_MODULE_VERSION 127."
      )
    );
    expect(msg).toContain("npm rebuild better-sqlite3");
    expect(msg).toContain("Node 22");
  });

  it("passes through generic errors", () => {
    expect(formatDbError(new Error("UNIQUE constraint failed"))).toBe(
      "UNIQUE constraint failed"
    );
  });
});
