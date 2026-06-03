"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import type { SlimCompareDoc } from "@/lib/query/compare-slim-doc";
import { cn } from "@/lib/utils";

export interface AiEvaluationResult {
  winner: "a" | "b" | "tie";
  confidence: "low" | "medium" | "high";
  reasons: string[];
  perSideNotes: { a: string; b: string };
  caveats: string[];
}

export function CompareSummary({
  metrics,
  slimA,
  slimB,
  aiAvailable,
  bothSourcesReady = false,
}: {
  metrics: CompareMetricsResult | null;
  slimA: SlimCompareDoc[];
  slimB: SlimCompareDoc[];
  aiAvailable: boolean;
  bothSourcesReady?: boolean;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiEvaluationResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setAiResult(null);
    setAiError(null);
  }, [metrics?.sideA.qSummary, metrics?.sideB.qSummary, metrics?.searchTerm]);

  if (!metrics) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
        Load two sources and run <strong className="text-foreground">Compare queries</strong>{" "}
        to see metrics.
      </div>
    );
  }

  const { sideA, sideB, overlap, heuristics, hints } = metrics;

  const handleAiEvaluate = async () => {
    if (!bothSourcesReady) {
      toast.error("Load both sources and run Compare queries first.");
      return;
    }
    if (!metrics) {
      toast.error("Run Compare queries before AI evaluation.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/compare/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm: metrics.searchTerm,
          sideA: {
            label: sideA.label,
            qSummary: sideA.qSummary,
            parser: sideA.parser,
            docs: slimA,
          },
          sideB: {
            label: sideB.label,
            qSummary: sideB.qSummary,
            parser: sideB.parser,
            docs: slimB,
          },
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        evaluation?: AiEvaluationResult;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `AI evaluation failed (${res.status})`);
      }
      if (!body.evaluation) {
        throw new Error("No evaluation returned.");
      }
      setAiResult(body.evaluation);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI evaluation failed";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const winnerLabel =
    aiResult?.winner === "a"
      ? "Source A"
      : aiResult?.winner === "b"
        ? "Source B"
        : aiResult?.winner === "tie"
          ? "Tie"
          : null;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Source A vs Source B</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={
            !bothSourcesReady ||
            !aiAvailable ||
            aiLoading ||
            !metrics ||
            slimA.length === 0 ||
            slimB.length === 0
          }
          onClick={() => void handleAiEvaluate()}
          title={
            aiAvailable
              ? "Compare top-10 relevance with AI"
              : "Set OPENAI_API_KEY or COMPARE_AI_API_KEY on the server"
          }
        >
          {aiLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Evaluate relevance (AI)
        </Button>
      </div>

      {!aiAvailable && (
        <p className="text-[11px] text-muted-foreground">
          AI evaluation is optional. Set{" "}
          <code className="rounded bg-muted px-1 font-mono">OPENAI_API_KEY</code> on
          the server to enable.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Metric</th>
              <th className="py-1.5 pr-3 font-medium">Source A</th>
              <th className="py-1.5 font-medium">Source B</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[11px]">
            <MetricRow label="Label" a={sideA.label} b={sideB.label} mono={false} />
            <MetricRow label="Query" a={sideA.qSummary} b={sideB.qSummary} wrap />
            <MetricRow
              label="Total hits"
              a={sideA.numFound.toLocaleString()}
              b={sideB.numFound.toLocaleString()}
              highlight
            />
            <MetricRow
              label="Fields"
              a={String(sideA.selectedFieldCount)}
              b={String(sideB.selectedFieldCount)}
            />
            <MetricRow
              label="Solr QTime"
              a={sideA.qTime != null ? `${sideA.qTime}ms` : "—"}
              b={sideB.qTime != null ? `${sideB.qTime}ms` : "—"}
            />
            <MetricRow
              label="Wall time"
              a={`${sideA.wallTimeMs.toFixed(0)}ms`}
              b={`${sideB.wallTimeMs.toFixed(0)}ms`}
            />
            <MetricRow
              label="Max score"
              a={fmtScore(sideA.maxScore)}
              b={fmtScore(sideB.maxScore)}
            />
            <MetricRow
              label="Avg score (top 10)"
              a={fmtScore(sideA.avgScoreTop10)}
              b={fmtScore(sideB.avgScoreTop10)}
            />
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <StatChip
          title="Overlap"
          value={`${overlap.overlapCount}/10 (${overlap.overlapPercent.toFixed(0)}%)`}
        />
        <StatChip
          title="Jaccard (top 10)"
          value={(overlap.jaccardTop10 * 100).toFixed(0) + "%"}
        />
        <StatChip title="Only in A" value={String(overlap.onlyInA)} />
        <StatChip title="Only in B" value={String(overlap.onlyInB)} />
        <StatChip
          title="Avg rank shift (shared)"
          value={
            overlap.avgRankDisplacement != null
              ? overlap.avgRankDisplacement.toFixed(1)
              : "—"
          }
        />
        <StatChip
          title="Score ratio (A/B max)"
          value={
            heuristics.topScoreRatio != null
              ? heuristics.topScoreRatio.toFixed(2)
              : "—"
          }
        />
      </div>

      <ul className="list-inside list-disc space-y-1 text-[11px] text-muted-foreground">
        {hints.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>

      {aiResult && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            aiResult.winner === "tie"
              ? "border-border bg-muted/30"
              : "border-[var(--solr-accent)]/40 bg-[var(--solr-accent)]/5"
          )}
        >
          <p className="font-medium text-foreground">
            AI verdict: {winnerLabel}
            <span className="ml-2 font-normal text-muted-foreground">
              ({aiResult.confidence} confidence)
            </span>
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-muted-foreground">
            {aiResult.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            <span className="font-medium text-foreground">A:</span>{" "}
            {aiResult.perSideNotes.a}
          </p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-medium text-foreground">B:</span>{" "}
            {aiResult.perSideNotes.b}
          </p>
          {aiResult.caveats.length > 0 && (
            <p className="mt-2 text-[10px] italic text-muted-foreground">
              {aiResult.caveats.join(" ")}
            </p>
          )}
        </div>
      )}
      {aiError && (
        <p className="text-[11px] text-destructive">{aiError}</p>
      )}
    </div>
  );
}

function MetricRow({
  label,
  a,
  b,
  wrap,
  mono = true,
  highlight = false,
}: {
  label: string;
  a: string;
  b: string;
  wrap?: boolean;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 align-top",
        highlight && "bg-[var(--solr-accent)]/10"
      )}
    >
      <td
        className={cn(
          "py-1.5 pr-3",
          highlight
            ? "font-medium text-[var(--solr-accent-muted)]"
            : "text-muted-foreground"
        )}
      >
        {label}
      </td>
      <td
        className={cn(
          "max-w-[14rem] py-1.5 pr-3",
          highlight ? "font-semibold text-foreground" : "text-foreground",
          mono && "font-mono",
          wrap && "break-all whitespace-normal"
        )}
      >
        {a}
      </td>
      <td
        className={cn(
          "max-w-[14rem] py-1.5",
          highlight ? "font-semibold text-foreground" : "text-foreground",
          mono && "font-mono",
          wrap && "break-all whitespace-normal"
        )}
      >
        {b}
      </td>
    </tr>
  );
}

function StatChip({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/15 px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{title}</p>
      <p className="font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function fmtScore(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(3);
}
