import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/presets/connections/route";
import { getSqliteRepository } from "@/lib/persistence";
import {
  createDefaultEndpoint,
  DEFAULT_ENDPOINT_ID,
} from "@/lib/solr/endpoints";
import {
  readJson,
  setupPresetsApiTests,
  teardownPresetsApiTests,
} from "@/app/api/presets/test-helpers";

describe("GET /api/presets/connections", () => {
  beforeEach(setupPresetsApiTests);
  afterEach(teardownPresetsApiTests);

  it("seeds and returns default connection state", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await readJson<{
      endpoints: { id: string; baseUrl: string }[];
      activeEndpointId: string;
    }>(res);

    expect(body.endpoints.length).toBeGreaterThanOrEqual(1);
    expect(body.endpoints.some((e) => e.id === DEFAULT_ENDPOINT_ID)).toBe(true);
    expect(body.activeEndpointId).toBeTruthy();
  });

  it("returns persisted endpoints after save", async () => {
    const repo = getSqliteRepository();
    repo.saveConnectionState({
      endpoints: [
        createDefaultEndpoint({ id: "saved", label: "Saved", lastCore: "items" }),
      ],
      activeEndpointId: "saved",
    });

    const res = await GET();
    const body = await readJson<{
      endpoints: { id: string; lastCore: string | null }[];
      activeEndpointId: string;
    }>(res);

    expect(body.endpoints).toHaveLength(1);
    expect(body.endpoints[0]?.id).toBe("saved");
    expect(body.endpoints[0]?.lastCore).toBe("items");
    expect(body.activeEndpointId).toBe("saved");
  });
});

describe("PUT /api/presets/connections", () => {
  beforeEach(setupPresetsApiTests);
  afterEach(teardownPresetsApiTests);

  it("persists valid connection state", async () => {
    const state = {
      endpoints: [
        createDefaultEndpoint({ id: "a", label: "A" }),
        createDefaultEndpoint({
          id: "b",
          label: "B",
          baseUrl: "https://b.example/solr",
          auth: { user: "u", pass: "p" },
        }),
      ],
      activeEndpointId: "b",
    };

    const res = await PUT(
      new Request("http://localhost/api/presets/connections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      })
    );

    expect(res.status).toBe(200);
    expect(await readJson<{ ok: boolean }>(res)).toEqual({ ok: true });

    const loaded = getSqliteRepository().getConnectionState();
    expect(loaded.endpoints).toHaveLength(2);
    expect(loaded.activeEndpointId).toBe("b");
    expect(loaded.endpoints[1]?.auth).toEqual({ user: "u", pass: "p" });
  });

  it("rejects invalid body", async () => {
    const res = await PUT(
      new Request("http://localhost/api/presets/connections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoints: "bad" }),
      })
    );

    expect(res.status).toBe(400);
    expect(await readJson<{ error: string }>(res)).toMatchObject({
      error: "Invalid connection state",
    });
  });

  it("rejects activeEndpointId not in endpoints list", async () => {
    const res = await PUT(
      new Request("http://localhost/api/presets/connections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoints: [createDefaultEndpoint({ id: "only" })],
          activeEndpointId: "missing",
        }),
      })
    );

    expect(res.status).toBe(400);
    expect(await readJson<{ error: string }>(res)).toMatchObject({
      error: "activeEndpointId must match an endpoint",
    });
  });

  it("rejects empty endpoints list", async () => {
    const res = await PUT(
      new Request("http://localhost/api/presets/connections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoints: [], activeEndpointId: "x" }),
      })
    );

    expect(res.status).toBe(400);
  });
});
