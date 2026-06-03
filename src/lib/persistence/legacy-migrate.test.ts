import { describe, expect, it } from "vitest";
import { connectionStateFromLegacyPayload } from "@/lib/persistence/legacy-migrate";
import { DEFAULT_ENDPOINT_ID, DEFAULT_SOLR_BASE_URL } from "@/lib/solr/endpoints";

describe("legacy connection migration", () => {
  it("parses zustand persist envelope with endpoints array", () => {
    const payload = {
      state: {
        endpoints: [
          {
            id: "custom",
            label: "Custom",
            baseUrl: "http://solr:8983/solr",
            auth: null,
            lastCore: "items",
          },
        ],
        activeEndpointId: "custom",
      },
      version: 1,
    };

    const parsed = connectionStateFromLegacyPayload(payload);
    expect(parsed?.endpoints).toHaveLength(1);
    expect(parsed?.activeEndpointId).toBe("custom");
    expect(parsed?.endpoints[0]?.lastCore).toBe("items");
  });

  it("migrates v0 single-endpoint shape", () => {
    const parsed = connectionStateFromLegacyPayload({
      baseUrl: "http://localhost:8983/solr",
      auth: { user: "admin", pass: "pw" },
      currentCore: "customers",
    });

    expect(parsed?.endpoints).toHaveLength(1);
    expect(parsed?.endpoints[0]?.id).toBe(DEFAULT_ENDPOINT_ID);
    expect(parsed?.endpoints[0]?.baseUrl).toBe(DEFAULT_SOLR_BASE_URL);
    expect(parsed?.endpoints[0]?.auth).toEqual({ user: "admin", pass: "pw" });
    expect(parsed?.endpoints[0]?.lastCore).toBe("customers");
    expect(parsed?.activeEndpointId).toBe(DEFAULT_ENDPOINT_ID);
  });

  it("returns null for invalid payload", () => {
    expect(connectionStateFromLegacyPayload(null)).toBeNull();
    expect(connectionStateFromLegacyPayload("bad")).toBeNull();
    expect(connectionStateFromLegacyPayload({})).not.toBeNull();
  });
});
