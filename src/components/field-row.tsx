"use client";

import { useCallback, useState } from "react";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useSchema, type FieldMeta } from "@/lib/schema/context";
import { runFieldAnalysis } from "@/lib/solr-client";
import { useSolrStore } from "@/lib/stores/solr-store";
import { FieldTypeBadge } from "@/components/field-type-popover";
import {
  lastNonEmptyStage,
  normalizeIndexStages,
} from "@/lib/solr-analysis-normalize";
import type { AnalysisStage, AnalysisToken, SolrFieldValue } from "@/types/solr";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function formatPrimitive(v: string | number | boolean | null) {
  if (v === null) return <span className="text-muted-foreground italic">null</span>;
  if (typeof v === "boolean") {
    return (
      <span
        className={
          v
            ? "rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-foreground"
            : "rounded border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
        }
      >
        {v ? "yes" : "no"}
      </span>
    );
  }
  if (typeof v === "number") {
    return <span className="font-mono">{Number.isInteger(v) ? v : v.toFixed(3)}</span>;
  }
  if (typeof v === "string") {
    if (ISO_DATE_RE.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return (
          <span className="font-mono" title={v}>
            {d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z")}
          </span>
        );
      }
    }
    return <span>{v}</span>;
  }
  return <span>{String(v)}</span>;
}

function PersistedValue({ value }: { value: SolrFieldValue | undefined }) {
  if (value === undefined || value === null) {
    return (
      <span className="text-xs italic text-muted-foreground">(no value)</span>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-xs italic text-muted-foreground">[]</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span
            key={i}
            className="rounded bg-muted/60 px-1 py-0.5 text-[11px] leading-tight"
          >
            {formatPrimitive(v)}
          </span>
        ))}
      </div>
    );
  }
  return <span className="text-xs leading-snug">{formatPrimitive(value)}</span>;
}

function valueToAnalyzeString(value: SolrFieldValue | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v))
      .join("\n");
  }
  return String(value);
}

interface AnalysisCacheEntry {
  loading: boolean;
  error: string | null;
  stages: AnalysisStage[] | null;
}

function IndexedTokens({
  meta,
  value,
}: {
  meta: FieldMeta;
  value: SolrFieldValue | undefined;
}) {
  const core = useSolrStore((s) => s.currentCore);
  const [entry, setEntry] = useState<AnalysisCacheEntry | null>(null);
  const [open, setOpen] = useState(false);

  const fieldType = meta.fieldType;
  const isTextLike =
    !!fieldType &&
    (/TextField/i.test(fieldType.class) ||
      !!fieldType.analyzer ||
      !!fieldType.indexAnalyzer);

  const stringValue = valueToAnalyzeString(value);

  const fetchAnalysis = useCallback(async () => {
    if (!core || !stringValue) return;
    setEntry({ loading: true, error: null, stages: null });
    try {
      const res = await runFieldAnalysis(core, meta.name, stringValue);
      const raw = res.analysis?.field_names?.[meta.name]?.index;
      const stages = normalizeIndexStages(raw);
      setEntry({ loading: false, error: null, stages });
    } catch (e) {
      setEntry({
        loading: false,
        error: e instanceof Error ? e.message : "Analysis failed",
        stages: null,
      });
    }
  }, [core, meta.name, stringValue]);

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !entry && isTextLike && stringValue) {
      void fetchAnalysis();
    }
  };

  if (!isTextLike) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
        disabled
        title="Non-text field type — no analyzer chain to run."
      >
        <Sparkles className="size-3" />
        indexed value: stored as-is
      </button>
    );
  }

  if (!stringValue) {
    return null;
  }

  const finalStage = lastNonEmptyStage(entry?.stages ?? null);

  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={`size-2.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Sparkles className="size-2.5" />
        indexed
      </button>
      {open && (
        <div className="mt-1 rounded border border-dashed border-border bg-muted/20 p-1.5">
          {entry?.loading && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 className="size-2.5 animate-spin" /> Analyzing…
            </div>
          )}
          {entry?.error && (
            <div className="text-[10px] text-destructive">{entry.error}</div>
          )}
          {entry && !entry.loading && !entry.error && (
            <div className="space-y-1">
              {finalStage ? (
                <>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    final stage:{" "}
                    <span className="font-mono normal-case">{finalStage[0]}</span>
                  </div>
                  {(finalStage[1] ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(finalStage[1] ?? []).map((t: AnalysisToken, i: number) => (
                        <span
                          key={i}
                          className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[10px] leading-tight text-foreground"
                          title={`pos ${t.position ?? ""}${t.type ? ` · ${t.type}` : ""}`}
                        >
                          {t.text ?? String(t)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] italic text-muted-foreground">
                      This stage has no token list (unexpected Solr shape).
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs italic text-muted-foreground">
                  Analysis returned no tokens.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FieldRow({
  name,
  value,
}: {
  name: string;
  value: SolrFieldValue | undefined;
}) {
  const schema = useSchema();
  const meta = schema.getFieldMeta(name);

  return (
    <div className="grid grid-cols-1 gap-1 border-t border-border/60 px-2 py-1 sm:grid-cols-[9.5rem_1fr] sm:items-start">
      <div className="flex flex-col gap-0.5">
        <div className="truncate font-mono text-[11px] leading-tight">{name}</div>
        <div className="flex flex-wrap items-center gap-0.5">
          <FieldTypeBadge
            typeName={meta.type}
            fieldName={name}
            className="h-5 min-h-0 gap-0.5 px-1 py-0 text-[10px] leading-none [&_svg]:size-2.5"
          />
          {meta.locale && (
            <span className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[9px] uppercase leading-none text-foreground">
              {meta.locale}
            </span>
          )}
          {meta.isDynamic && (
            <span
              className="rounded border border-dashed border-border px-1 py-0.5 font-mono text-[9px] uppercase leading-none text-muted-foreground"
              title={`dynamic rule ${meta.dynamicMatch?.rule.name ?? ""}`}
            >
              dyn
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <PersistedValue value={value} />
        <IndexedTokens meta={meta} value={value} />
      </div>
    </div>
  );
}
