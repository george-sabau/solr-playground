"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EndpointManager } from "@/components/endpoint-manager";
import { EndpointSwitcher } from "@/components/endpoint-switcher";
import { useSolrStore } from "@/lib/stores/solr-store";
import { cn } from "@/lib/utils";

export function CoreSwitcher() {
  const activeEndpointId = useSolrStore((s) => s.activeEndpointId);
  const cores = useSolrStore((s) => s.cores);
  const currentCore = useSolrStore((s) => s.currentCore);
  const setCurrentCore = useSolrStore((s) => s.setCurrentCore);
  const [busy, setBusy] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
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
  }, [activeEndpointId]);

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
    <>
      <div className="flex flex-wrap items-center gap-2">
        <EndpointSwitcher onManage={() => setManagerOpen(true)} />
        <Select
          value={currentCore}
          onValueChange={(value) => setCurrentCore(value)}
          disabled={cores.length === 0 || busy}
        >
          <SelectTrigger className="min-w-[180px]">
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
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-sm" }),
            "size-8 shrink-0"
          )}
          aria-label="Manage Solr endpoints"
          onClick={() => setManagerOpen(true)}
        >
          <Settings2 className="size-4" />
        </button>
      </div>
      <EndpointManager open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
