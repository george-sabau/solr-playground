import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createDefaultEndpoint,
  DEFAULT_ENDPOINT_ID,
  DEFAULT_SOLR_BASE_URL,
  getActiveEndpoint,
  normalizeBaseUrl,
  type SolrAuth,
  type SolrEndpoint,
  type SolrEndpointInput,
} from "@/lib/solr/endpoints";

export type { SolrAuth, SolrEndpoint } from "@/lib/solr/endpoints";

export interface CoreOption {
  name: string;
}

export interface SolrState {
  endpoints: SolrEndpoint[];
  activeEndpointId: string;
  cores: CoreOption[];
  currentCore: string | null;
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

function syncLastCoreOnActive(
  endpoints: SolrEndpoint[],
  activeEndpointId: string,
  currentCore: string | null
): SolrEndpoint[] {
  return endpoints.map((e) =>
    e.id === activeEndpointId ? { ...e, lastCore: currentCore } : e
  );
}

type PersistedV0 = {
  baseUrl?: string;
  auth?: SolrAuth | null;
  currentCore?: string | null;
  cores?: CoreOption[];
  endpoints?: SolrEndpoint[];
  activeEndpointId?: string;
};

export const useSolrStore = create<SolrState>()(
  persist(
    (set, get) => ({
      endpoints: [defaultEndpoint],
      activeEndpointId: DEFAULT_ENDPOINT_ID,
      cores: [],
      currentCore: null,

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
              label:
                patch.label !== undefined ? patch.label.trim() : e.label,
            };
          }),
        }));
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
          return;
        }

        set({ endpoints: remaining });
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
      },
    }),
    {
      name: "solr-playground",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        endpoints: state.endpoints,
        activeEndpointId: state.activeEndpointId,
      }),
      migrate: (persisted, version) => {
        const p = persisted as PersistedV0;
        if (version >= 1 && p.endpoints && p.activeEndpointId) {
          return {
            endpoints: p.endpoints,
            activeEndpointId: p.activeEndpointId,
          };
        }

        const baseUrl =
          normalizeBaseUrl(p.baseUrl ?? DEFAULT_SOLR_BASE_URL) ??
          DEFAULT_SOLR_BASE_URL;
        const endpoint = createDefaultEndpoint({
          baseUrl,
          auth: p.auth ?? null,
          lastCore: p.currentCore ?? null,
        });

        return {
          endpoints: [endpoint],
          activeEndpointId: endpoint.id,
        };
      },
    }
  )
);

export function useActiveEndpoint(): SolrEndpoint | null {
  return useSolrStore((s) => getActiveEndpoint(s));
}

export function useActiveBaseUrl(): string {
  return useSolrStore(
    (s) => getActiveEndpoint(s)?.baseUrl ?? DEFAULT_SOLR_BASE_URL
  );
}
