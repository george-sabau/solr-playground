"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchema } from "@/lib/schema/context";
import { runSelect } from "@/lib/solr-client";
import { useSolrStore } from "@/lib/stores/solr-store";
import { ResultDoc } from "@/components/result-doc";
import { cn } from "@/lib/utils";
import type { SelectResponse } from "@/types/solr";

const DEFAULT_QUERY = "*:*";
const PAGE_SIZE = 20;

export function QueryPlayground() {
  const core = useSolrStore((s) => s.currentCore);
  const baseUrl = useSolrStore((s) => s.baseUrl);
  const schema = useSchema();

  const [draftQuery, setDraftQuery] = useState(DEFAULT_QUERY);
  const [committedQuery, setCommittedQuery] = useState(DEFAULT_QUERY);
  const [start, setStart] = useState(0);

  const [response, setResponse] = useState<SelectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** When true, every hit is expanded except keys in `collapsedInExpandAll`. */
  const [expandAllMode, setExpandAllMode] = useState(false);
  const [collapsedInExpandAll, setCollapsedInExpandAll] = useState<
    Set<string>
  >(() => new Set());
  /** When `expandAllMode` is false, only these keys are expanded. */
  const [openWhenNormal, setOpenWhenNormal] = useState<Set<string>>(
    () => new Set()
  );

  const runQuery = useCallback(
    async (q: string, startIdx: number) => {
      if (!core) {
        setResponse(null);
        setExpandAllMode(false);
        setCollapsedInExpandAll(new Set());
        setOpenWhenNormal(new Set());
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await runSelect(core, {
          q,
          start: startIdx,
          rows: PAGE_SIZE,
        });
        setResponse(res);
        setExpandAllMode(false);
        setCollapsedInExpandAll(new Set());
        setOpenWhenNormal(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setResponse(null);
        setExpandAllMode(false);
        setCollapsedInExpandAll(new Set());
        setOpenWhenNormal(new Set());
      } finally {
        setLoading(false);
      }
    },
    [core]
  );

  useEffect(() => {
    if (!core) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runQuery(committedQuery, start);
  }, [core, baseUrl, committedQuery, start, runQuery]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStart(0);
    setCommittedQuery(draftQuery.trim() || DEFAULT_QUERY);
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
          Solr query syntax. Default is{" "}
          <code className="rounded bg-muted px-1 font-mono">*:*</code>; the
          handler defaults to <code className="font-mono">edismax</code> against{" "}
          <code className="font-mono">_text_</code>.
        </p>
      </header>
      <div className="space-y-4 px-6 py-5">
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
          <Input
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="*:*"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className={cn(
              "min-w-[12rem] flex-1 font-mono sm:min-w-[18rem]",
              "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/25"
            )}
          />
          <Button
            type="submit"
            disabled={loading}
            className={cn(
              "border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)]",
              "shadow-sm hover:bg-[var(--solr-accent-hover)]",
              "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/35"
            )}
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play />
            )}
            Run
          </Button>
        </form>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {response && !error && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
              query:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                {committedQuery}
              </code>
            </span>
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
