"use client";

import { useState } from "react";
import { GitCompare, Play, TableProperties } from "lucide-react";
import { useSolrStore, useActiveBaseUrl } from "@/lib/stores/solr-store";
import { SchemaProvider } from "@/lib/schema/context";
import { SchemaPanel } from "@/components/schema-panel";
import { QueryPlayground } from "@/components/query-playground";
import { ComparePanel } from "@/components/compare-panel";
import { cn } from "@/lib/utils";

type HomeTab = "play" | "compare" | "analyze";

export function HomeContent() {
  const baseUrl = useActiveBaseUrl();
  const activeEndpointId = useSolrStore((s) => s.activeEndpointId);
  const currentCore = useSolrStore((s) => s.currentCore);
  const [tab, setTab] = useState<HomeTab>("play");

  const panelKey = `${activeEndpointId}::${currentCore ?? "_"}`;

  return (
    <SchemaProvider core={currentCore} baseUrl={baseUrl}>
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-4 p-6",
          tab === "compare" ? "max-w-[90rem]" : "max-w-6xl"
        )}
      >
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
            aria-selected={tab === "compare"}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === "compare"
                ? "bg-card text-card-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("compare")}
          >
            <GitCompare
              className={cn(
                "size-4 shrink-0",
                tab === "compare" && "text-[var(--solr-accent)]"
              )}
              aria-hidden
            />
            Compare
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

        {tab === "play" && <QueryPlayground key={panelKey} />}
        {tab === "compare" && <ComparePanel key={panelKey} />}
        {tab === "analyze" && <SchemaPanel />}
      </div>
    </SchemaProvider>
  );
}
