import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/presets/migrate-local/route";
import { getSqliteRepository } from "@/lib/persistence";
import { DEFAULT_ENDPOINT_ID } from "@/lib/solr/endpoints";
import {
  readJson,
  setupPresetsApiTests,
  teardownPresetsApiTests,
} from "@/app/api/presets/test-helpers";

describe("POST /api/presets/migrate-local", () => {
  beforeEach(setupPresetsApiTests);
  afterEach(teardownPresetsApiTests);

  it("migrates legacy localStorage payload when database is empty", async () => {
    const res = await POST(
      new Request("http://localhost/api/presets/migrate-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            baseUrl: "http://localhost:8983/solr",
            auth: { user: "admin", pass: "pw" },
            currentCore: "customers",
          },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(await readJson<{ migrated: boolean }>(res)).toEqual({ migrated: true });

    const state = getSqliteRepository().getConnectionState();
    expect(state.endpoints[0]?.id).toBe(DEFAULT_ENDPOINT_ID);
    expect(state.endpoints[0]?.auth).toEqual({ user: "admin", pass: "pw" });
    expect(state.endpoints[0]?.lastCore).toBe("customers");
  });

  it("skips migration when database already has endpoints", async () => {
    getSqliteRepository().seedDefaultIfEmpty();

    const res = await POST(
      new Request("http://localhost/api/presets/migrate-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            baseUrl: "http://other:8983/solr",
            currentCore: "other",
          },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(await readJson<{ migrated: boolean; reason: string }>(res)).toEqual({
      migrated: false,
      reason: "not_empty",
    });
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(
      new Request("http://localhost/api/presets/migrate-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: null }),
      })
    );

    expect(res.status).toBe(400);
    expect(await readJson<{ migrated: boolean; reason: string }>(res)).toEqual({
      migrated: false,
      reason: "invalid_payload",
    });
  });
});
