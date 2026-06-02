"use client";

import { Separator } from "@/components/ui/separator";
import { CoreSwitcher } from "@/components/core-switcher";
import {
  endpointDisplayLabel,
  getActiveEndpoint,
} from "@/lib/solr/endpoints";
import { useSolrStore } from "@/lib/stores/solr-store";

function HeaderChip({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs md:flex"
      title={title}
    >
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="max-w-[14rem] truncate font-mono text-foreground">
        {value}
      </span>
    </div>
  );
}

export function AppHeader() {
  const active = useSolrStore((s) => getActiveEndpoint(s));
  const currentCore = useSolrStore((s) => s.currentCore);

  const endpointLabel = active
    ? endpointDisplayLabel(active)
    : "—";

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold tracking-tight">
          Solr Playground
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Query and analyze without mutating data
        </span>
      </div>
      <div className="hidden items-center gap-2 lg:flex">
        <HeaderChip
          label="Endpoint"
          value={endpointLabel}
          title={active?.baseUrl}
        />
        <HeaderChip label="Active core" value={currentCore ?? "—"} />
      </div>
      <Separator orientation="vertical" className="hidden h-8 sm:block" />
      <CoreSwitcher />
    </header>
  );
}
