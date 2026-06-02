"use client";

import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compileClassicSearch } from "@/lib/query/compile";
import type { ClassicQueryState, QueryParserMode } from "@/lib/query/types";
import { QueryRequestPreview } from "@/components/query-request-preview";
import {
  EdismaxSettingsFields,
  ParserModeSelect,
} from "@/components/query-shared-fields";
import { cn } from "@/lib/utils";

const accentButtonClass = cn(
  "border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)]",
  "shadow-sm hover:bg-[var(--solr-accent-hover)]",
  "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/35"
);

export function QueryClassicPanel({
  core,
  baseUrl,
  state,
  onChange,
  parser,
  onParserChange,
  onRun,
  loading,
}: {
  core: string;
  baseUrl: string;
  state: ClassicQueryState;
  onChange: (next: ClassicQueryState) => void;
  parser: QueryParserMode;
  onParserChange: (v: QueryParserMode) => void;
  onRun: () => void;
  loading: boolean;
}) {
  const plan = compileClassicSearch(state, parser);
  const showEdismax = parser === "edismax" || parser === "dismax";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
        <ParserModeSelect value={parser} onChange={onParserChange} />
        <div className="grid gap-1.5">
          <Label htmlFor="classic-q" className="text-xs">
            q (query syntax)
          </Label>
          <Input
            id="classic-q"
            value={state.q}
            onChange={(e) => onChange({ ...state, q: e.target.value })}
            placeholder="*:*"
            spellCheck={false}
            className="font-mono text-sm focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/25"
          />
          <p className="text-[11px] text-muted-foreground">
            Lucene query syntax in{" "}
            <code className="rounded bg-muted px-1 font-mono">q</code>. Default
            match-all is{" "}
            <code className="rounded bg-muted px-1 font-mono">*:*</code>.
          </p>
        </div>
      </div>

      {showEdismax && (
        <EdismaxSettingsFields
          value={state.edismax}
          onChange={(edismax) => onChange({ ...state, edismax })}
          showQf
          qf={state.qf}
          onQfChange={(qf) => onChange({ ...state, qf })}
          qfPlaceholder="title^2 body (optional)"
        />
      )}

      <QueryRequestPreview
        baseUrl={baseUrl}
        core={core}
        q={plan.q}
        extra={plan.extra}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={loading}
          className={accentButtonClass}
          onClick={onRun}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Play />}
          Run
        </Button>
      </div>
    </div>
  );
}
