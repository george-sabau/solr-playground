"use client";

import { useEffect, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { CompareReportDocument } from "@/components/compare/compare-report-document";
import {
  clearCompareReportStorage,
  compareReportFilename,
  readCompareReportFromStorage,
  type CompareReportPayload,
} from "@/lib/compare/report-payload";

type ReportState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; blobUrl: string; filename: string; payload: CompareReportPayload };

export default function CompareReportPage() {
  const [state, setState] = useState<ReportState>({ status: "loading" });
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      const payload = readCompareReportFromStorage();
      if (!payload) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              "No report data found. Open this page by clicking Export report on the Compare tab after running Compare queries.",
          });
        }
        return;
      }

      clearCompareReportStorage();

      try {
        const blob = await pdf(<CompareReportDocument data={payload} />).toBlob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setState({
          status: "ready",
          blobUrl,
          filename: compareReportFilename(
            payload.generatedAt,
            payload.audience
          ),
          payload,
        });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              e instanceof Error ? e.message : "Failed to generate PDF report.",
          });
        }
      }
    }

    void generate();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-8 text-foreground">
        <p className="text-sm font-medium">Generating report…</p>
        <p className="text-xs text-muted-foreground">
          Building your comparison evaluation PDF.
        </p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
        <h1 className="text-base font-semibold">Could not generate report</h1>
        <p className="max-w-md text-sm text-muted-foreground">{state.message}</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-neutral-800">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-700 bg-neutral-900 px-4 py-2 text-neutral-100">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {state.payload.productName} — comparison report
          </p>
          <p className="truncate text-[11px] text-neutral-400">
            {state.payload.core} · {state.payload.endpointLabel}
          </p>
        </div>
        <a
          href={state.blobUrl}
          download={state.filename}
          className="shrink-0 rounded-md bg-[var(--solr-accent)] px-3 py-1.5 text-xs font-medium text-[var(--solr-accent-fg)] hover:opacity-90"
        >
          Download PDF
        </a>
      </header>
      <embed
        src={state.blobUrl}
        type="application/pdf"
        className="min-h-0 flex-1 w-full"
        title="Comparison report PDF"
      />
    </main>
  );
}
