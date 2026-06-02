"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSchema } from "@/lib/schema/context";
import {
  compileBuilderSearch,
  compileClassicSearch,
} from "@/lib/query/compile";
import {
  DEFAULT_BUILDER_STATE,
  DEFAULT_EDISMAX,
  type PlayQueryMode,
  type QueryParserMode,
  type SearchPlan,
} from "@/lib/query/types";
import { runSelect } from "@/lib/solr-client";
import { useActiveBaseUrl, useSolrStore } from "@/lib/stores/solr-store";
import { ResultDoc } from "@/components/result-doc";
import { QueryBuilderPanel } from "@/components/query-builder-panel";
import { QueryClassicPanel } from "@/components/query-classic-panel";
import { cn } from "@/lib/utils";
import type { SelectResponse } from "@/types/solr";

const DEFAULT_QUERY = "*:*";
const PAGE_SIZE = 20;

export function QueryPlayground() {
  const core = useSolrStore((s) => s.currentCore);
  const activeEndpointId = useSolrStore((s) => s.activeEndpointId);
  const baseUrl = useActiveBaseUrl();
  const schema = useSchema();

  const [playTab, setPlayTab] = useState<PlayQueryMode>("classic");
  const [parserMode, setParserMode] = useState<QueryParserMode>("lucene");
  const [classicState, setClassicState] = useState({
    q: DEFAULT_QUERY,
    edismax: { ...DEFAULT_EDISMAX },
    qf: "",
  });
  const [builderState, setBuilderState] = useState(DEFAULT_BUILDER_STATE);

  const [committedPlan, setCommittedPlan] = useState<SearchPlan>({
    q: DEFAULT_QUERY,
    extra: { defType: "lucene" },
    summary: DEFAULT_QUERY,
  });
  const [start, setStart] = useState(0);

  const [response, setResponse] = useState<SelectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandAllMode, setExpandAllMode] = useState(false);
  const [collapsedInExpandAll, setCollapsedInExpandAll] = useState<
    Set<string>
  >(() => new Set());
  const [openWhenNormal, setOpenWhenNormal] = useState<Set<string>>(
    () => new Set()
  );

  const resetExpansion = useCallback(() => {
    setExpandAllMode(false);
    setCollapsedInExpandAll(new Set());
    setOpenWhenNormal(new Set());
  }, []);

  const runSearch = useCallback(
    async (plan: SearchPlan, startIdx: number) => {
      if (!core) {
        setResponse(null);
        resetExpansion();
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await runSelect(core, {
          q: plan.q,
          start: startIdx,
          rows: PAGE_SIZE,
          extra: plan.extra,
        });
        setResponse(res);
        resetExpansion();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setResponse(null);
        resetExpansion();
      } finally {
        setLoading(false);
      }
    },
    [core, resetExpansion]
  );

  useEffect(() => {
    if (!core) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSearch(committedPlan, start);
  }, [core, activeEndpointId, committedPlan, start, runSearch]);

  const handleRunClassic = () => {
    const plan = compileClassicSearch(classicState, parserMode);
    setStart(0);
    setCommittedPlan(plan);
  };

  const handleRunBuilder = () => {
    const plan = compileBuilderSearch(builderState, parserMode);
    setStart(0);
    setCommittedPlan(plan);
  };

  const numFound = response?.response.numFound ?? 0;
  const docs = useMemo(
    () => response?.response.docs ?? [],
    [response]
  );
  const qTime = response?.responseHeader.QTime;
  const maxScore =
    response?.response.maxScore ??
    (docs.length > 0
      ? docs.reduce((m, d) => (typeof d.score === "number" ? Math.max(m, d.score) : m), 0)
      : undefined);

  const docKeys = useMemo(
    () =>
      docs.map(
        (doc, i) =>
          `${start + i}:${doc.id != null ? String(doc.id) : `noid-${i}`}`
      ),
    [docs, start]
  );

  const isDocExpanded = useCallback(
    (docKey: string) =>
      expandAllMode ? !collapsedInExpandAll.has(docKey) : openWhenNormal.has(docKey),
    [collapsedInExpandAll, expandAllMode, openWhenNormal]
  );

  const toggleDoc = useCallback(
    (docKey: string) => {
      if (expandAllMode) {
        setCollapsedInExpandAll((prev) => {
          const next = new Set(prev);
          if (next.has(docKey)) next.delete(docKey);
          else next.add(docKey);
          return next;
        });
      } else {
        setOpenWhenNormal((prev) => {
          const next = new Set(prev);
          if (next.has(docKey)) next.delete(docKey);
          else next.add(docKey);
          return next;
        });
      }
    },
    [expandAllMode]
  );

  const expandAllResults = useCallback(() => {
    setExpandAllMode(true);
    setCollapsedInExpandAll(new Set());
  }, []);

  const collapseAllResults = useCallback(() => {
    setExpandAllMode(false);
    setOpenWhenNormal(new Set());
  }, []);

  const hasNext = start + PAGE_SIZE < numFound;
  const hasPrev = start > 0;

  if (!core) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Search</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a core to run queries.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold">
          Search{" "}
          <span className="ml-1 font-mono text-xs text-muted-foreground">
            {core}
          </span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Classic Lucene syntax or a visual field builder — same{" "}
          <code className="font-mono">/select</code> endpoint, parser selectable
          per run.
        </p>
      </header>

      <div className="border-b border-border px-6 pt-4">
        <div
          role="tablist"
          aria-label="Query input mode"
          className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1"
        >
          {(
            [
              ["classic", "Classic syntax"],
              ["builder", "Query builder"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={playTab === id}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                playTab === id
                  ? "bg-card text-card-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPlayTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-6 py-5">
        {playTab === "classic" ? (
          <QueryClassicPanel
            core={core}
            baseUrl={baseUrl}
            state={classicState}
            onChange={setClassicState}
            parser={parserMode}
            onParserChange={setParserMode}
            onRun={handleRunClassic}
            loading={loading}
          />
        ) : (
          <QueryBuilderPanel
            core={core}
            baseUrl={baseUrl}
            parser={parserMode}
            onParserChange={setParserMode}
            state={builderState}
            onChange={setBuilderState}
            onRun={handleRunBuilder}
            loading={loading}
          />
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {response && !error && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="text-foreground">{numFound}</span> hits
            </span>
            {typeof qTime === "number" && (
              <span>
                in <span className="text-foreground">{qTime}ms</span>
              </span>
            )}
            <span>
              showing{" "}
              <span className="text-foreground">
                {numFound === 0 ? 0 : start + 1}
                {numFound === 0 ? "" : `–${Math.min(start + PAGE_SIZE, numFound)}`}
              </span>
            </span>
            <span>
              q:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                {committedPlan.summary}
              </code>
            </span>
            {committedPlan.extra.defType && (
              <span>
                parser:{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                  {committedPlan.extra.defType}
                </code>
              </span>
            )}
            {schema.loading && (
              <span className="ml-auto inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin text-[var(--solr-accent)]" />
                loading schema
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {docs.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={expandAllMode}
              onClick={() =>
                expandAllMode ? collapseAllResults() : expandAllResults()
              }
            >
              {expandAllMode ? "Collapse all" : "Expand all"}
            </Button>
          )}
          {docs.map((doc, i) => {
            const docKey = docKeys[i]!;
            return (
              <ResultDoc
                key={docKey}
                rank={start + i + 1}
                doc={doc}
                maxScore={maxScore}
                expanded={isDocExpanded(docKey)}
                onToggle={() => toggleDoc(docKey)}
              />
            );
          })}
          {!loading && docs.length === 0 && response && (
            <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No documents matched.
            </div>
          )}
        </div>

        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrev || loading}
              onClick={() => setStart(Math.max(0, start - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => setStart(start + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
