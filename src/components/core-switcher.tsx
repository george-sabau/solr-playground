"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSolrStore } from "@/lib/stores/solr-store";
import { ConnectionSettings } from "@/components/connection-settings";

export function CoreSwitcher() {
  const baseUrl = useSolrStore((s) => s.baseUrl);
  const cores = useSolrStore((s) => s.cores);
  const currentCore = useSolrStore((s) => s.currentCore);
  const setCurrentCore = useSolrStore((s) => s.setCurrentCore);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // Subscribe to baseUrl changes; refreshCores owns its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    void useSolrStore
      .getState()
      .refreshCores()
      .catch((e) => {
        if (alive) {
          toast.error(
            e instanceof Error ? e.message : "Could not load cores from Solr"
          );
        }
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [baseUrl]);

  const handleRefresh = () => {
    setBusy(true);
    void useSolrStore
      .getState()
      .refreshCores()
      .catch((e) => {
        toast.error(
          e instanceof Error ? e.message : "Could not load cores from Solr"
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentCore}
        onValueChange={(value) => setCurrentCore(value)}
        disabled={cores.length === 0 || busy}
      >
        <SelectTrigger className="min-w-[220px]">
          <SelectValue
            placeholder={
              cores.length === 0 ? "No cores (check Solr)" : "Select core"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {cores.map((c) => (
            <SelectItem key={c.name} value={c.name}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="size-8 shrink-0"
        onClick={handleRefresh}
        disabled={busy}
        aria-label="Refresh cores"
      >
        <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
      </Button>
      <ConnectionSettings />
    </div>
  );
}
