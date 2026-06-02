"use client";

import { useState } from "react";
import { Play, TableProperties } from "lucide-react";
import { useSolrStore, useActiveBaseUrl } from "@/lib/stores/solr-store";
import { SchemaProvider } from "@/lib/schema/context";
import { SchemaPanel } from "@/components/schema-panel";
import { QueryPlayground } from "@/components/query-playground";
import { cn } from "@/lib/utils";

type HomeTab = "play" | "analyze";

export function HomeContent() {
  const baseUrl = useActiveBaseUrl();
  const activeEndpointId = useSolrStore((s) => s.activeEndpointId);
  const currentCore = useSolrStore((s) => s.currentCore);
  const [tab, setTab] = useState<HomeTab>("play");

  return (
    <SchemaProvider core={currentCore} baseUrl={baseUrl}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
        <div
          role="tablist"
          aria-label="Solr playground sections"
          className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "play"}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === "play"
                ? "bg-card text-card-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("play")}
          >
            <Play
              className={cn(
                "size-4 shrink-0",
                tab === "play" && "text-[var(--solr-accent)]"
              )}
              aria-hidden
            />
            Play
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "analyze"}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === "analyze"
                ? "bg-card text-card-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("analyze")}
          >
            <TableProperties
              className={cn(
                "size-4 shrink-0",
                tab === "analyze" && "text-[var(--solr-accent)]"
              )}
              aria-hidden
            />
            Analyze
          </button>
        </div>

        {tab === "play" ? (
          <QueryPlayground key={`${activeEndpointId}::${currentCore ?? "_"}`} />
        ) : (
          <SchemaPanel />
        )}
      </div>
    </SchemaProvider>
  );
}
