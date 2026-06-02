"use client";

import { buildSelectRequestUrl } from "@/lib/query/compile";

export function QueryRequestPreview({
  baseUrl,
  core,
  q,
  extra,
  start,
  rows,
}: {
  baseUrl: string;
  core: string;
  q: string;
  extra: Record<string, string>;
  start?: number;
  rows?: number;
}) {
  const { proxy, upstream } = buildSelectRequestUrl(baseUrl, core, q, extra, {
    start,
    rows,
  });

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
      <p className="text-xs font-medium text-muted-foreground">Request preview</p>
      <div className="space-y-1.5">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            App proxy
          </span>
          <pre className="mt-0.5 max-h-20 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px] text-foreground">
            {proxy}
          </pre>
        </div>
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Solr upstream
          </span>
          <pre className="mt-0.5 max-h-20 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px] text-foreground">
            {upstream}
          </pre>
        </div>
      </div>
    </div>
  );
}
