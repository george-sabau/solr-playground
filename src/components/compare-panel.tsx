"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitCompare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CompareColumn,
  isCompareColumnReady,
  type CompareColumnState,
} from "@/components/compare-column";
import { CompareSummary } from "@/components/compare-summary";
import type { AiCompareSummary } from "@/lib/ai/compare/types";
import {
  buildCompareReportPayload,
  serializeCompareReportPayload,
} from "@/lib/compare/report-payload";
import { compileBuilderSearch } from "@/lib/query/compile";
import { computeCompareMetrics } from "@/lib/query/compare-metrics";
import { getSearchableFields } from "@/lib/query/fields";
import {
  DEFAULT_BUILDER_STATE,
  type SearchPlan,
} from "@/lib/query/types";
import { runSelect } from "@/lib/solr-client";
import { useSchema } from "@/lib/schema/context";
import { useSolrStore } from "@/lib/stores/solr-store";
import { cn } from "@/lib/utils";
import type { SelectResponse } from "@/types/solr";

const COMPARE_ROWS = 10;

function emptyColumn(): CompareColumnState {
  return {
    builderState: DEFAULT_BUILDER_STATE,
    parser: "lucene",
    importUrl: "",
    importError: null,
    importWarnings: [],
    sourceLabel: null,
    sourceReady: false,
  };
}

export function ComparePanel() {
  const core = useSolrStore((s) => s.currentCore);
  const activeEndpointId = useSolrStore((s) => s.activeEndpointId);
  const endpoints = useSolrStore((s) => s.endpoints);
  const endpointLabel =
    endpoints.find((e) => e.id === activeEndpointId)?.label ?? "Solr endpoint";
  const schema = useSchema();

  const [searchText, setSearchText] = useState("");
  const [columnA, setColumnA] = useState<CompareColumnState>(emptyColumn);
  const [columnB, setColumnB] = useState<CompareColumnState>(emptyColumn);

  const [planA, setPlanA] = useState<SearchPlan | null>(null);
  const [planB, setPlanB] = useState<SearchPlan | null>(null);
  const [responseA, setResponseA] = useState<SelectResponse | null>(null);
  const [responseB, setResponseB] = useState<SelectResponse | null>(null);
  const [wallA, setWallA] = useState(0);
  const [wallB, setWallB] = useState(0);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState<AiCompareSummary | null>(
    null
  );
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/compare/evaluate", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ available?: boolean }>)
      .then((d) => setAiAvailable(!!d.available))
      .catch(() => setAiAvailable(false));
  }, []);

  const searchableFields = useMemo(
    () => getSearchableFields(schema.schema),
    [schema.schema]
  );

  const metrics = useMemo(() => {
    if (!planA || !planB) return null;
    if (!responseA && !responseB) return null;
    return computeCompareMetrics({
      searchTerm: searchText,
      labelA: columnA.sourceLabel ?? "Source A",
      labelB: columnB.sourceLabel ?? "Source B",
      planA,
      planB,
      builderA: columnA.builderState,
      builderB: columnB.builderState,
      responseA,
      responseB,
      wallTimeA: wallA,
      wallTimeB: wallB,
    });
  }, [
    searchText,
    columnA,
    columnB,
    planA,
    planB,
    responseA,
    responseB,
    wallA,
    wallB,
  ]);

  const columnAReady = isCompareColumnReady(columnA);
  const columnBReady = isCompareColumnReady(columnB);
  const bothSourcesReady = columnAReady && columnBReady;

  const handleCompare = useCallback(async () => {
    if (!core) return;
    if (!isCompareColumnReady(columnA) || !isCompareColumnReady(columnB)) {
      toast.error("Load both Source A and Source B before comparing.");
      return;
    }

    const stateA = { ...columnA.builderState, searchText };
    const stateB = { ...columnB.builderState, searchText };
    const nextPlanA = compileBuilderSearch(stateA, columnA.parser);
    const nextPlanB = compileBuilderSearch(stateB, columnB.parser);
    setPlanA(nextPlanA);
    setPlanB(nextPlanB);
    setAiEvaluation(null);
    setColumnA((c) => ({ ...c, builderState: stateA }));
    setColumnB((c) => ({ ...c, builderState: stateB }));

    setLoadingA(true);
    setLoadingB(true);
    setErrorA(null);
    setErrorB(null);

    const runSide = async (
      plan: SearchPlan
    ): Promise<{ res: SelectResponse | null; wall: number; err: string | null }> => {
      const t0 = performance.now();
      try {
        const res = await runSelect(core, {
          q: plan.q,
          start: 0,
          rows: COMPARE_ROWS,
          extra: plan.extra,
          fq: plan.fq,
          bq: plan.bq,
        });
        return { res, wall: performance.now() - t0, err: null };
      } catch (e) {
        return {
          res: null,
          wall: performance.now() - t0,
          err: e instanceof Error ? e.message : "Search failed",
        };
      }
    };

    const [outA, outB] = await Promise.all([
      runSide(nextPlanA),
      runSide(nextPlanB),
    ]);

    setResponseA(outA.res);
    setWallA(outA.wall);
    setErrorA(outA.err);
    setLoadingA(false);

    setResponseB(outB.res);
    setWallB(outB.wall);
    setErrorB(outB.err);
    setLoadingB(false);

    if (outA.err && outB.err) {
      toast.error("Both searches failed.");
    } else if (outA.err || outB.err) {
      toast.error(outA.err ?? outB.err ?? "One search failed.");
    }
  }, [core, columnA, columnB, searchText]);

  const handleExportReport = useCallback(() => {
    if (!core || !planA || !planB || !metrics) {
      toast.error("Run Compare queries first.");
      return;
    }
    setExportLoading(true);
    try {
      const payload = buildCompareReportPayload({
        core,
        endpointLabel,
        sharedSearch: searchText,
        columnA,
        columnB,
        planA,
        planB,
        responseA,
        responseB,
        metrics,
        ai: aiEvaluation,
      });
      const stored = serializeCompareReportPayload(payload);
      if (!stored.ok) {
        toast.error(stored.reason);
        return;
      }
      const reportUrl = new URL("/compare/report", window.location.origin).href;
      window.open(reportUrl, "_blank", "noopener,noreferrer");
    } finally {
      setExportLoading(false);
    }
  }, [
    core,
    planA,
    planB,
    metrics,
    endpointLabel,
    searchText,
    columnA,
    columnB,
    responseA,
    responseB,
    aiEvaluation,
  ]);

  if (!core) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Compare</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a core to compare two query sources.
        </p>
      </div>
    );
  }

  const accentButtonClass = cn(
    "border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)]",
    "shadow-sm hover:bg-[var(--solr-accent-hover)]",
    "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/35"
  );

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <header className="border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <GitCompare className="size-4 text-[var(--solr-accent)]" />
          Compare
          <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">
            {core}
          </span>
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Load a query setup on <strong className="text-foreground">Source A</strong> and{" "}
          <strong className="text-foreground">Source B</strong> (URL or template), then
          enter a shared search term and compare. Both sides must be loaded before
          running a comparison.
        </p>
      </header>

      <div className="space-y-4 px-6 py-5">
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="compare-search" className="text-xs">
            Search (shared)
          </Label>
          <Input
            id="compare-search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="What are you looking for?"
            spellCheck={false}
            className="text-sm focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/25"
            onKeyDown={(e) => {
              if (e.key === "Enter" && bothSourcesReady) {
                e.preventDefault();
                void handleCompare();
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            className={accentButtonClass}
            disabled={loadingA || loadingB || !bothSourcesReady}
            onClick={() => void handleCompare()}
          >
            {loadingA || loadingB ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitCompare className="size-4" />
            )}
            Compare queries
          </Button>
          {!bothSourcesReady && (
            <p className="text-[11px] text-muted-foreground">
              {!columnAReady && !columnBReady
                ? "Load Source A and Source B to enable comparison."
                : !columnAReady
                  ? "Load Source A to enable comparison."
                  : "Load Source B to enable comparison."}
            </p>
          )}
        </div>

        <CompareSummary
          metrics={metrics}
          responseA={responseA}
          responseB={responseB}
          aiAvailable={aiAvailable}
          aiResult={aiEvaluation}
          onAiResultChange={setAiEvaluation}
          onExportReport={handleExportReport}
          exportLoading={exportLoading}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <CompareColumn
            title="Source A"
            endpointId={activeEndpointId}
            core={core}
            column={columnA}
            onColumnChange={setColumnA}
            searchableFields={searchableFields}
            plan={planA}
            response={responseA}
            loading={loadingA}
            error={errorA}
            stats={
              responseA
                ? {
                    numFound: responseA.response.numFound,
                    qTime: responseA.responseHeader.QTime ?? null,
                    wallTimeMs: wallA,
                  }
                : undefined
            }
          />
          <CompareColumn
            title="Source B"
            endpointId={activeEndpointId}
            core={core}
            column={columnB}
            onColumnChange={setColumnB}
            searchableFields={searchableFields}
            plan={planB}
            response={responseB}
            loading={loadingB}
            error={errorB}
            stats={
              responseB
                ? {
                    numFound: responseB.response.numFound,
                    qTime: responseB.responseHeader.QTime ?? null,
                    wallTimeMs: wallB,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </section>
  );
}
