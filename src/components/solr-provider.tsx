"use client";

import { useEffect } from "react";
import { useSolrStore } from "@/lib/stores/solr-store";

export function SolrProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useSolrStore.persist.rehydrate();
  }, []);

  return <>{children}</>;
}

export function useSolr() {
  return useSolrStore();
}
