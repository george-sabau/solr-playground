"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, FileDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AiCompareSummary } from "@/lib/ai/compare/types";
import type { ReportAudience } from "@/lib/compare/report-payload";
import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import type { SelectResponse } from "@/types/solr";
import { cn } from "@/lib/utils";

export type { AiCompareSummary as AiEvaluationResult };

function CollapsiblePanel({
  title,
  defaultOpen,
  children,
  actions,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <details
      className="group rounded-lg border border-border bg-card shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-border px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-[var(--solr-accent)]" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{title}</h3>
        {actions ? (
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.preventDefault()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </summary>
      <div className="space-y-4 p-4">{children}</div>
    </details>
  );
}

export function CompareSummary({
  metrics,
  responseA,
  responseB,
  aiAvailable,
  aiResult,
  onAiResultChange,
  onExportReport,
  exportLoading,
}: {
  metrics: CompareMetricsResult | null;
  responseA: SelectResponse | null;
  responseB: SelectResponse | null;
  aiAvailable: boolean;
  aiResult: AiCompareSummary | null;
  onAiResultChange: (result: AiCompareSummary | null) => void;
  onExportReport: (audience: ReportAudience) => void;
  exportLoading?: boolean;
}) {
  const aiResetKey = metrics
    ? `${metrics.searchTerm}|${metrics.sideA.qSummary}|${metrics.sideB.qSummary}`
    : "idle";

  if (!metrics) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
        Load two sources and run{" "}
        <strong className="text-foreground">Compare queries</strong> to see
        metrics.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ComparisonMetricsSummary
        metrics={metrics}
        aiAvailable={aiAvailable}
        onExportReport={onExportReport}
        exportLoading={exportLoading}
      />
      <CompareAiSummary
        key={aiResetKey}
        metrics={metrics}
        responseA={responseA}
        responseB={responseB}
        aiAvailable={aiAvailable}
        aiResult={aiResult}
        onAiResultChange={onAiResultChange}
      />
    </div>
  );
}

function ComparisonMetricsSummary({
  metrics,
  aiAvailable,
  onExportReport,
  exportLoading,
}: {
  metrics: CompareMetricsResult;
  aiAvailable: boolean;
  onExportReport: (audience: ReportAudience) => void;
  exportLoading?: boolean;
}) {
  const { sideA, sideB, overlap, heuristics, hints } = metrics;
  const [reportAudience, setReportAudience] =
    useState<ReportAudience>("technical");

  const accentButtonClass = cn(
    "h-9 text-sm",
    "border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)]",
    "shadow-sm hover:bg-[var(--solr-accent-hover)]",
    "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/35"
  );

  const exportControls = (
    <div className="flex items-center gap-2">
      <Select
        value={reportAudience}
        onValueChange={(v) => setReportAudience(v as ReportAudience)}
        disabled={!!exportLoading}
      >
        <SelectTrigger
          className="h-9 w-[7.5rem] text-xs"
          title={
            !aiAvailable
              ? "Business reports require GEMINI_API_KEY on the server"
              : "Report audience"
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="technical">Technical</SelectItem>
          <SelectItem
            value="business"
            disabled={!aiAvailable}
            title={
              !aiAvailable
                ? "Set GEMINI_API_KEY in .env.local on the server"
                : undefined
            }
          >
            Business
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        className={accentButtonClass}
        disabled={!!exportLoading}
        onClick={() => onExportReport(reportAudience)}
        title="Open a PDF evaluation report in a new tab"
      >
        {exportLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileDown className="size-4" />
        )}
        Export report
      </Button>
    </div>
  );

  return (
    <CollapsiblePanel
      title="Comparison summary"
      defaultOpen
      actions={exportControls}
    >
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
    </CollapsiblePanel>
  );
}

function CompareAiSummary({
  metrics,
  responseA,
  responseB,
  aiAvailable,
  aiResult,
  onAiResultChange,
}: {
  metrics: CompareMetricsResult;
  responseA: SelectResponse | null;
  responseB: SelectResponse | null;
  aiAvailable: boolean;
  aiResult: AiCompareSummary | null;
  onAiResultChange: (result: AiCompareSummary | null) => void;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const compareResultsReady = !!responseA && !!responseB;
  const docsReady =
    (responseA?.response.docs.length ?? 0) > 0 &&
    (responseB?.response.docs.length ?? 0) > 0;

  const aiButtonDisabledReason = aiLoading
    ? "AI evaluation in progress…"
    : !aiAvailable
      ? "Set GEMINI_API_KEY in .env.local on the server"
      : !compareResultsReady
        ? "Run Compare queries first"
        : !docsReady
          ? "Both sides need at least one result document — use a search term that returns hits on A and B"
          : null;

  const handleAiEvaluate = async () => {
    if (!compareResultsReady || !responseA || !responseB) {
      toast.error("Load both sources and run Compare queries first.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    onAiResultChange(null);
    setPanelOpen(true);
    try {
      const res = await fetch("/api/compare/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm: metrics.searchTerm,
          sideA: {
            label: metrics.sideA.label,
            qSummary: metrics.sideA.qSummary,
            parser: metrics.sideA.parser,
            response: responseA,
          },
          sideB: {
            label: metrics.sideB.label,
            qSummary: metrics.sideB.qSummary,
            parser: metrics.sideB.parser,
            response: responseB,
          },
          metrics,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        evaluation?: AiCompareSummary;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `AI evaluation failed (${res.status})`);
      }
      if (!body.evaluation) {
        throw new Error("No evaluation returned.");
      }
      onAiResultChange(body.evaluation);
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

  const evaluateButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      disabled={!!aiButtonDisabledReason}
      onClick={() => void handleAiEvaluate()}
      title={aiButtonDisabledReason ?? "Compare full result lists with Gemini"}
    >
      {aiLoading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      Evaluate relevance (AI)
    </Button>
  );

  return (
    <details
      className="group rounded-lg border border-border bg-card shadow-sm"
      open={panelOpen || !!aiResult}
      onToggle={(e) => setPanelOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-border px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-[var(--solr-accent)]" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold">AI summary</h3>
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {evaluateButton}
        </div>
      </summary>
      <div className="space-y-3 p-4">
        {!aiAvailable && (
          <p className="text-[11px] text-muted-foreground">
            AI evaluation is optional. Copy{" "}
            <code className="rounded bg-muted px-1 font-mono">.env.example</code>{" "}
            to <code className="rounded bg-muted px-1 font-mono">.env.local</code>{" "}
            and set{" "}
            <code className="rounded bg-muted px-1 font-mono">GEMINI_API_KEY</code>{" "}
            from{" "}
            <a
              href="https://aistudio.google.com/apikey"
              className="text-[var(--solr-accent-muted)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Studio
            </a>
            .
          </p>
        )}

        {aiResult && (
          <div
            className={cn(
              "space-y-3 rounded-md border px-3 py-3 text-xs",
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
            {aiResult.summary && (
              <p className="leading-relaxed text-foreground">{aiResult.summary}</p>
            )}
            {aiResult.reasons.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-foreground">Why</p>
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {aiResult.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiResult.metricsInterpretation.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-foreground">
                  Metrics interpretation
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {aiResult.metricsInterpretation.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">A:</span>{" "}
              {aiResult.perSideNotes.a}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">B:</span>{" "}
              {aiResult.perSideNotes.b}
            </p>
            {aiResult.caveats.length > 0 && (
              <p className="text-[10px] italic text-muted-foreground">
                {aiResult.caveats.join(" ")}
              </p>
            )}
          </div>
        )}

        {aiError && <p className="text-[11px] text-destructive">{aiError}</p>}

        {aiAvailable && aiButtonDisabledReason && !aiLoading && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            {aiButtonDisabledReason}
          </p>
        )}

        {aiAvailable && docsReady && !aiResult && !aiError && !aiLoading && (
          <p className="text-[11px] text-muted-foreground">
            Click <strong className="text-foreground">Evaluate relevance (AI)</strong>{" "}
            to send both full Solr result lists and the comparison metrics to Gemini
            for a relevance summary.
          </p>
        )}
      </div>
    </details>
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
