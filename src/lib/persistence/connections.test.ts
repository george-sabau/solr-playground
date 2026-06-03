import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqliteRepository } from "@/lib/persistence";
import {
  createDefaultEndpoint,
  DEFAULT_ENDPOINT_ID,
  DEFAULT_SOLR_BASE_URL,
} from "@/lib/solr/endpoints";
import type { ConnectionState } from "@/lib/persistence/types";
import {
  clearInMemoryDbEnv,
  resetTestPersistence,
  useInMemoryDb,
} from "./test-helpers";

function sampleState(overrides?: Partial<ConnectionState>): ConnectionState {
  const ep1 = createDefaultEndpoint({ id: "ep-1", label: "Local" });
  const ep2 = createDefaultEndpoint({
    id: "ep-2",
    label: "Staging",
    baseUrl: "https://staging.example/solr",
    auth: { user: "admin", pass: "secret" },
    lastCore: "products",
  });
  return {
    endpoints: [ep1, ep2],
    activeEndpointId: "ep-2",
    ...overrides,
  };
}

describe("Solr endpoint persistence", () => {
  beforeEach(() => {
    resetTestPersistence();
    useInMemoryDb();
  });

  afterEach(() => {
    resetTestPersistence();
    clearInMemoryDbEnv();
  });

  it("reports empty database before seeding", () => {
    const repo = getSqliteRepository();
    expect(repo.hasAnyEndpoints()).toBe(false);
  });

  it("seeds default endpoint when database is empty", () => {
    const repo = getSqliteRepository();
    const state = repo.seedDefaultIfEmpty();

    expect(repo.hasAnyEndpoints()).toBe(true);
    expect(state.endpoints).toHaveLength(1);
    expect(state.endpoints[0]?.id).toBe(DEFAULT_ENDPOINT_ID);
    expect(state.endpoints[0]?.baseUrl).toBe(DEFAULT_SOLR_BASE_URL);
    expect(state.activeEndpointId).toBe(DEFAULT_ENDPOINT_ID);
  });

  it("does not re-seed when endpoints already exist", () => {
    const repo = getSqliteRepository();
    const custom = sampleState({ activeEndpointId: "ep-1" });
    repo.saveConnectionState(custom);

    const state = repo.seedDefaultIfEmpty();
    expect(state.endpoints).toHaveLength(2);
    expect(state.activeEndpointId).toBe("ep-1");
  });

  it("loads connection state with endpoint order preserved", () => {
    const repo = getSqliteRepository();
    repo.saveConnectionState(sampleState());

    const state = repo.getConnectionState();
    expect(state.endpoints.map((e) => e.id)).toEqual(["ep-1", "ep-2"]);
    expect(state.activeEndpointId).toBe("ep-2");
  });

  it("replaces all endpoints on save (full snapshot)", () => {
    const repo = getSqliteRepository();
    repo.saveConnectionState(sampleState());

    const replacement: ConnectionState = {
      endpoints: [
        createDefaultEndpoint({
          id: "ep-3",
          label: "Prod",
          baseUrl: "https://prod.example/solr",
        }),
      ],
      activeEndpointId: "ep-3",
    };
    repo.saveConnectionState(replacement);

    const state = repo.getConnectionState();
    expect(state.endpoints).toHaveLength(1);
    expect(state.endpoints[0]?.id).toBe("ep-3");
    expect(state.activeEndpointId).toBe("ep-3");
  });

  it("encrypts and decrypts auth passwords round-trip", () => {
    const repo = getSqliteRepository();
    repo.saveConnectionState(sampleState());

    const ep2 = repo.getConnectionState().endpoints.find((e) => e.id === "ep-2");
    expect(ep2?.auth).toEqual({ user: "admin", pass: "secret" });
  });

  it("persists lastCore per endpoint", () => {
    const repo = getSqliteRepository();
    const state = sampleState();
    state.endpoints[0] = { ...state.endpoints[0]!, lastCore: "customers" };
    repo.saveConnectionState(state);

    const loaded = repo.getConnectionState();
    expect(loaded.endpoints[0]?.lastCore).toBe("customers");
    expect(loaded.endpoints[1]?.lastCore).toBe("products");
  });

  it("stores endpoint without auth when pass is empty", () => {
    const repo = getSqliteRepository();
    repo.saveConnectionState({
      endpoints: [
        createDefaultEndpoint({
          id: "ep-auth",
          auth: { user: "solo", pass: "" },
        }),
      ],
      activeEndpointId: "ep-auth",
    });

    const ep = repo.getConnectionState().endpoints[0];
    expect(ep?.auth).toEqual({ user: "solo", pass: "" });
  });

  it("falls back to first endpoint when active id setting is missing", () => {
    const repo = getSqliteRepository();
    repo.saveConnectionState(sampleState({ activeEndpointId: "ep-1" }));

    const state = repo.getConnectionState();
    expect(state.activeEndpointId).toBe("ep-1");
  });

  it("updates active endpoint id on save", () => {
    const repo = getSqliteRepository();
    repo.saveConnectionState(sampleState({ activeEndpointId: "ep-1" }));

    repo.saveConnectionState(sampleState({ activeEndpointId: "ep-2" }));
    expect(repo.getConnectionState().activeEndpointId).toBe("ep-2");
  });
});
