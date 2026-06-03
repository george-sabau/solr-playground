"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResultDoc } from "@/components/result-doc";
import type { SolrDoc } from "@/types/solr";

export function QueryResultsList({
  docs,
  start = 0,
  maxScore,
  loading,
  error,
  searched = false,
  showExpandControls = true,
}: {
  docs: SolrDoc[];
  start?: number;
  maxScore?: number;
  loading?: boolean;
  error?: string | null;
  /** When true, show empty state if docs.length is 0. */
  searched?: boolean;
  showExpandControls?: boolean;
}) {
  const [expandAllMode, setExpandAllMode] = useState(false);
  const [collapsedInExpandAll, setCollapsedInExpandAll] = useState<
    Set<string>
  >(() => new Set());
  const [openWhenNormal, setOpenWhenNormal] = useState<Set<string>>(
    () => new Set()
  );

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

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {showExpandControls && docs.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={expandAllMode}
          onClick={() => {
            if (expandAllMode) {
              setExpandAllMode(false);
              setOpenWhenNormal(new Set());
            } else {
              setExpandAllMode(true);
              setCollapsedInExpandAll(new Set());
            }
          }}
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
      {!loading && docs.length === 0 && searched && !error && (
        <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No documents matched.
        </div>
      )}
    </div>
  );
}
