import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface SolrAuth {
  user: string;
  pass: string;
}

export interface CoreOption {
  name: string;
}

export interface SolrState {
  baseUrl: string;
  auth: SolrAuth | null;
  cores: CoreOption[];
  currentCore: string | null;
  setBaseUrl: (baseUrl: string) => void;
  setAuth: (auth: SolrAuth | null) => void;
  setCurrentCore: (name: string | null) => void;
  refreshCores: () => Promise<void>;
}

export const useSolrStore = create<SolrState>()(
  persist(
    (set) => ({
      baseUrl: "http://localhost:8983/solr",
      auth: null,
      cores: [],
      currentCore: null,
      setBaseUrl: (baseUrl) => set({ baseUrl: baseUrl.trim().replace(/\/+$/, "") }),
      setAuth: (auth) => set({ auth }),
      setCurrentCore: (name) => set({ currentCore: name }),
      refreshCores: async () => {
        const { fetchCoresStatus } = await import("@/lib/solr-client");
        const names = await fetchCoresStatus();
        const cores = names.map((name) => ({ name }));
        set((state) => {
          let nextCore = state.currentCore;
          if (!nextCore || !cores.some((c) => c.name === nextCore)) {
            nextCore = cores[0]?.name ?? null;
          }
          return { cores, currentCore: nextCore };
        });
      },
    }),
    {
      name: "solr-playground",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        baseUrl: state.baseUrl,
        auth: state.auth,
        currentCore: state.currentCore,
        cores: state.cores,
      }),
    }
  )
);
