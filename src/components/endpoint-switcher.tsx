"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Server } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  endpointDisplayLabel,
} from "@/lib/solr/endpoints";
import { useSolrStore } from "@/lib/stores/solr-store";

const MANAGE_VALUE = "__manage__";

export function EndpointSwitcher({ onManage }: { onManage: () => void }) {
  const endpoints = useSolrStore((s) => s.endpoints);
  const activeEndpointId = useSolrStore((s) => s.activeEndpointId);
  const setActiveEndpoint = useSolrStore((s) => s.setActiveEndpoint);
  const [busy, setBusy] = useState(false);

  const handleChange = (value: string | null) => {
    if (!value) return;
    if (value === MANAGE_VALUE) {
      onManage();
      return;
    }
    if (value === activeEndpointId) return;
    setBusy(true);
    void setActiveEndpoint(value)
      .catch((e) => {
        toast.error(
          e instanceof Error ? e.message : "Could not switch Solr endpoint"
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <Select
      value={activeEndpointId}
      onValueChange={handleChange}
      disabled={busy || endpoints.length === 0}
    >
      <SelectTrigger className="min-w-[180px] max-w-[240px]" size="sm">
        <Server className="mr-1 size-3.5 shrink-0 text-[var(--solr-accent)]" />
        <SelectValue placeholder="Select endpoint" />
      </SelectTrigger>
      <SelectContent align="start">
        {endpoints.map((ep) => (
          <SelectItem key={ep.id} value={ep.id}>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">
                {endpointDisplayLabel(ep)}
              </span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {ep.baseUrl}
              </span>
            </div>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={MANAGE_VALUE}>Manage endpoints…</SelectItem>
      </SelectContent>
    </Select>
  );
}
