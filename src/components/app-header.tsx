"use client";

import { Separator } from "@/components/ui/separator";
import { CoreSwitcher } from "@/components/core-switcher";
import { useSolrStore } from "@/lib/stores/solr-store";

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs md:flex">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="max-w-[18rem] truncate font-mono text-foreground">
        {value}
      </span>
    </div>
  );
}

export function AppHeader() {
  const baseUrl = useSolrStore((s) => s.baseUrl);
  const currentCore = useSolrStore((s) => s.currentCore);

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
      <div className="flex items-center gap-2">
        <HeaderChip label="Base URL" value={baseUrl} />
        <HeaderChip label="Active core" value={currentCore ?? "—"} />
      </div>
      <Separator orientation="vertical" className="hidden h-8 sm:block" />
      <CoreSwitcher />
    </header>
  );
}
