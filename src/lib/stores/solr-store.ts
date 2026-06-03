import { create } from "zustand";
import {
  createDefaultEndpoint,
  DEFAULT_SOLR_BASE_URL,
  getActiveEndpoint,
  normalizeBaseUrl,
  type SolrEndpoint,
  type SolrEndpointInput,
} from "@/lib/solr/endpoints";
import {
  fetchConnections,
  saveConnections,
  type HydrationStatus,
} from "@/lib/presets-api";

export type { SolrAuth, SolrEndpoint } from "@/lib/solr/endpoints";
export type { HydrationStatus };

export interface CoreOption {
  name: string;
}

export interface SolrState {
  endpoints: SolrEndpoint[];
  activeEndpointId: string;
  cores: CoreOption[];
  currentCore: string | null;
  hydrationStatus: HydrationStatus;
  hydrateFromServer: () => Promise<void>;
  addEndpoint: (input: SolrEndpointInput) => string;
  updateEndpoint: (
    id: string,
    patch: Partial<Omit<SolrEndpoint, "id">>
  ) => void;
  removeEndpoint: (id: string) => void;
  setActiveEndpoint: (id: string) => Promise<void>;
  setCurrentCore: (name: string | null) => void;
  refreshCores: () => Promise<void>;
}

const defaultEndpoint = createDefaultEndpoint();

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleConnectionPersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { endpoints, activeEndpointId, hydrationStatus } =
      useSolrStore.getState();
    if (hydrationStatus !== "ready") return;
    void saveConnections({ endpoints, activeEndpointId }).catch(() => {
      // Best-effort; UI keeps working with in-memory state.
    });
  }, 300);
}

function syncLastCoreOnActive(
  endpoints: SolrEndpoint[],
  activeEndpointId: string,
  currentCore: string | null
): SolrEndpoint[] {
  return endpoints.map((e) =>
    e.id === activeEndpointId ? { ...e, lastCore: currentCore } : e
  );
}

function applyConnectionPersist(): void {
  scheduleConnectionPersist();
}

export const useSolrStore = create<SolrState>()((set, get) => ({
  endpoints: [defaultEndpoint],
  activeEndpointId: defaultEndpoint.id,
  cores: [],
  currentCore: null,
  hydrationStatus: "idle",

  hydrateFromServer: async () => {
    set({ hydrationStatus: "loading" });
    try {
      const { endpoints, activeEndpointId } = await fetchConnections();
      const active = endpoints.find((e) => e.id === activeEndpointId);
      set({
        endpoints: endpoints.length > 0 ? endpoints : [defaultEndpoint],
        activeEndpointId:
          active?.id ?? endpoints[0]?.id ?? defaultEndpoint.id,
        currentCore: active?.lastCore ?? null,
        cores: [],
        hydrationStatus: "ready",
      });
    } catch {
      set({ hydrationStatus: "error" });
    }
  },

  addEndpoint: (input) => {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    if (!baseUrl) {
      throw new Error("Invalid Solr base URL (use http:// or https://)");
    }
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ep-${Date.now()}`;
    const endpoint: SolrEndpoint = {
      id,
      label: input.label?.trim() ?? "",
      baseUrl,
      auth: input.auth ?? null,
      lastCore: null,
    };
    set((s) => ({ endpoints: [...s.endpoints, endpoint] }));
    applyConnectionPersist();
    return id;
  },

  updateEndpoint: (id, patch) => {
    set((s) => ({
      endpoints: s.endpoints.map((e) => {
        if (e.id !== id) return e;
        let baseUrl = e.baseUrl;
        if (patch.baseUrl !== undefined) {
          const next = normalizeBaseUrl(patch.baseUrl);
          if (!next) {
            throw new Error(
              "Invalid Solr base URL (use http:// or https://)"
            );
          }
          baseUrl = next;
        }
        return {
          ...e,
          ...patch,
          baseUrl,
          label: patch.label !== undefined ? patch.label.trim() : e.label,
        };
      }),
    }));
    applyConnectionPersist();
  },

  removeEndpoint: (id) => {
    const state = get();
    if (state.endpoints.length <= 1) {
      const reset = createDefaultEndpoint({
        lastCore: state.currentCore,
      });
      set({
        endpoints: [reset],
        activeEndpointId: reset.id,
        currentCore: reset.lastCore,
        cores: [],
      });
      applyConnectionPersist();
      return;
    }

    const remaining = state.endpoints.filter((e) => e.id !== id);
    let nextActive = state.activeEndpointId;
    let nextCore = state.currentCore;

    if (state.activeEndpointId === id) {
      const saved = syncLastCoreOnActive(
        state.endpoints,
        state.activeEndpointId,
        state.currentCore
      );
      const first = remaining[0]!;
      nextActive = first.id;
      nextCore = first.lastCore;
      set({
        endpoints: saved.filter((e) => e.id !== id),
        activeEndpointId: nextActive,
        currentCore: nextCore,
        cores: [],
      });
      applyConnectionPersist();
      return;
    }

    set({ endpoints: remaining });
    applyConnectionPersist();
  },

  setActiveEndpoint: async (id) => {
    const state = get();
    if (state.activeEndpointId === id) return;
    const target = state.endpoints.find((e) => e.id === id);
    if (!target) return;

    const endpoints = syncLastCoreOnActive(
      state.endpoints,
      state.activeEndpointId,
      state.currentCore
    );

    set({
      endpoints,
      activeEndpointId: id,
      currentCore: target.lastCore,
      cores: [],
    });
    applyConnectionPersist();

    await get().refreshCores();
  },

  setCurrentCore: (name) => {
    set((s) => ({
      currentCore: name,
      endpoints: syncLastCoreOnActive(
        s.endpoints,
        s.activeEndpointId,
        name
      ),
    }));
    applyConnectionPersist();
  },

  refreshCores: async () => {
    const active = getActiveEndpoint(get());
    if (!active) {
      set({ cores: [], currentCore: null });
      return;
    }

    const { fetchCoresStatus } = await import("@/lib/solr-client");
    const names = await fetchCoresStatus();
    const cores = names.map((name) => ({ name }));
    set((state) => {
      let nextCore = state.currentCore;
      if (!nextCore || !cores.some((c) => c.name === nextCore)) {
        const activeEp = getActiveEndpoint(state);
        const remembered = activeEp?.lastCore;
        nextCore =
          remembered && cores.some((c) => c.name === remembered)
            ? remembered
            : (cores[0]?.name ?? null);
      }
      const endpoints = syncLastCoreOnActive(
        state.endpoints,
        state.activeEndpointId,
        nextCore
      );
      return { cores, currentCore: nextCore, endpoints };
    });
    applyConnectionPersist();
  },
}));

export function useActiveEndpoint(): SolrEndpoint | null {
  return useSolrStore((s) => getActiveEndpoint(s));
}

export function useActiveBaseUrl(): string {
  return useSolrStore(
    (s) => getActiveEndpoint(s)?.baseUrl ?? DEFAULT_SOLR_BASE_URL
  );
}
