"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSchema } from "@/lib/schema/context";
import type {
  SchemaAnalyzer,
  SchemaAnalyzerComponent,
  SchemaFieldType,
} from "@/types/solr";
import { cn } from "@/lib/utils";

const SKIP_ATTRS = new Set(["class", "name"]);

function componentLabel(c: SchemaAnalyzerComponent): string {
  if (c.name) return String(c.name);
  if (c.class) {
    const cls = String(c.class);
    return cls.replace(/^solr\./, "");
  }
  return "(unnamed)";
}

function ComponentChip({ c }: { c: SchemaAnalyzerComponent }) {
  const attrs = Object.entries(c).filter(
    ([k, v]) => !SKIP_ATTRS.has(k) && v !== undefined && v !== null && v !== ""
  );
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
      <div className="font-mono font-medium">{componentLabel(c)}</div>
      {attrs.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          {attrs.map(([k, v]) => (
            <span key={k} className="font-mono">
              {k}={String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyzerChain({
  label,
  analyzer,
}: {
  label: string;
  analyzer: SchemaAnalyzer | undefined;
}) {
  if (!analyzer) return null;
  const charFilters = analyzer.charFilters ?? [];
  const tokenizer = analyzer.tokenizer;
  const filters = analyzer.filters ?? [];
  const empty = !tokenizer && charFilters.length === 0 && filters.length === 0;
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {analyzer.class && (
        <div className="text-xs text-muted-foreground">
          class:{" "}
          <span className="font-mono text-foreground">
            {String(analyzer.class).replace(/^solr\./, "")}
          </span>
        </div>
      )}
      {empty && !analyzer.class && (
        <div className="text-xs italic text-muted-foreground">
          No analyzer chain (non-text field type).
        </div>
      )}
      <div className="flex flex-col gap-1">
        {charFilters.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">
              charFilters
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {charFilters.map((c, i) => (
                <ComponentChip key={i} c={c} />
              ))}
            </div>
          </div>
        )}
        {tokenizer && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">
              tokenizer
            </div>
            <div className="mt-1">
              <ComponentChip c={tokenizer} />
            </div>
          </div>
        )}
        {filters.length > 0 && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">
              filters
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {filters.map((f, i) => (
                <ComponentChip key={i} c={f} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function summarizeType(ft: SchemaFieldType) {
  const flagKeys = [
    "indexed",
    "stored",
    "multiValued",
    "docValues",
    "sortMissingLast",
    "omitNorms",
    "omitTermFreqAndPositions",
    "positionIncrementGap",
  ] as const;
  return flagKeys
    .filter((k) => ft[k] !== undefined && ft[k] !== null)
    .map((k) => ({ k, v: ft[k] }));
}

export function FieldTypePopoverContent({
  fieldType,
  fieldName,
}: {
  fieldType: SchemaFieldType | null;
  fieldName?: string;
}) {
  const schema = useSchema();
  if (!fieldType) {
    return (
      <PopoverContent className="w-80">
        <PopoverHeader>
          <PopoverTitle>Unknown field type</PopoverTitle>
        </PopoverHeader>
        <div className="text-xs text-muted-foreground">
          The schema does not define a field type for this entry.
        </div>
      </PopoverContent>
    );
  }

  const summary = summarizeType(fieldType);
  const indexAnalyzer = fieldType.indexAnalyzer ?? fieldType.analyzer;
  const queryAnalyzer = fieldType.queryAnalyzer ?? fieldType.analyzer;
  const incoming = fieldName ? schema.copyFieldsByDest.get(fieldName) ?? [] : [];
  const outgoing = fieldName ? schema.copyFieldsBySource.get(fieldName) ?? [] : [];

  return (
    <PopoverContent className="z-50 w-[26rem] max-h-[32rem] overflow-y-auto">
      <PopoverHeader>
        <PopoverTitle>
          <span className="font-mono">{fieldType.name}</span>
        </PopoverTitle>
        <div className="text-xs text-muted-foreground">
          class:{" "}
          <span className="font-mono">
            {fieldType.class.replace(/^solr\./, "")}
          </span>
        </div>
      </PopoverHeader>
      {summary.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.map(({ k, v }) => (
            <span
              key={k}
              className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
            >
              {k}={String(v)}
            </span>
          ))}
        </div>
      )}
      {fieldType.similarity?.class && (
        <div className="text-xs">
          similarity:{" "}
          <span className="font-mono">{fieldType.similarity.class}</span>
        </div>
      )}
      <div className="space-y-3 border-t border-border pt-2">
        {fieldType.analyzer && (
          <AnalyzerChain label="analyzer" analyzer={fieldType.analyzer} />
        )}
        {fieldType.indexAnalyzer && (
          <AnalyzerChain label="index analyzer" analyzer={indexAnalyzer} />
        )}
        {fieldType.queryAnalyzer && (
          <AnalyzerChain label="query analyzer" analyzer={queryAnalyzer} />
        )}
        {!fieldType.analyzer &&
          !fieldType.indexAnalyzer &&
          !fieldType.queryAnalyzer && (
            <div className="text-xs italic text-muted-foreground">
              No analyzer chain (e.g. StrField / *PointField).
            </div>
          )}
      </div>
      {fieldName && (incoming.length > 0 || outgoing.length > 0) && (
        <div className="space-y-1.5 border-t border-border pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            CopyField wiring
          </div>
          {outgoing.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">copies to: </span>
              {outgoing.map((cf, i) => (
                <span key={i} className="font-mono">
                  {cf.dest}
                  {i < outgoing.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}
          {incoming.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">populated from: </span>
              {incoming.map((cf, i) => (
                <span key={i} className="font-mono">
                  {cf.source}
                  {i < incoming.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </PopoverContent>
  );
}

export function FieldTypeBadge({
  typeName,
  fieldName,
  className,
}: {
  typeName: string | null;
  fieldName?: string;
  className?: string;
}) {
  const schema = useSchema();
  if (!typeName) {
    return (
      <span
        className={cn(
          "rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground",
          className
        )}
      >
        unknown
      </span>
    );
  }
  const ft = schema.getFieldType(typeName);
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-muted",
          className
        )}
        aria-label={`Field type ${typeName}`}
      >
        <span>{typeName}</span>
        <Info className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <FieldTypePopoverContent fieldType={ft} fieldName={fieldName} />
    </Popover>
  );
}
