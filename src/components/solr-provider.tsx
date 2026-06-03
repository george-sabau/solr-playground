"use client";

import { useEffect } from "react";
import {
  markLocalStorageMigrated,
  migrateFromLocalStorage,
  readLegacyLocalStoragePayload,
} from "@/lib/presets-api";
import { useSolrStore } from "@/lib/stores/solr-store";

export function SolrProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void (async () => {
      const legacy = readLegacyLocalStoragePayload();
      if (legacy) {
        try {
          const result = await migrateFromLocalStorage(legacy);
          if (result.migrated || result.reason === "not_empty") {
            markLocalStorageMigrated();
          }
        } catch {
          // Continue with server hydration if migration fails.
        }
      }

      await useSolrStore.getState().hydrateFromServer();
      await useSolrStore.getState().refreshCores();
    })();
  }, []);

  return <>{children}</>;
}

export function useSolr() {
  return useSolrStore();
}
