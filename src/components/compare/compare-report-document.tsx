import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { AiCompareSummary } from "@/lib/ai/compare/types";
import type {
  CompareReportPayload,
  CompareReportSourceSide,
} from "@/lib/compare/report-payload";
import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import type { SlimCompareDoc } from "@/lib/query/compare-slim-doc";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  coverTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginTop: 120,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: "#444",
    marginBottom: 32,
  },
  coverMeta: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#333",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    color: "#111",
  },
  subsection: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 6,
    color: "#333",
  },
  mono: {
    fontFamily: "Courier",
    fontSize: 9,
    lineHeight: 1.4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
    paddingVertical: 3,
    fontSize: 9,
  },
  colMetric: { width: "28%" },
  colA: { width: "36%" },
  colB: { width: "36%" },
  bullet: {
    fontSize: 9,
    lineHeight: 1.45,
    marginBottom: 3,
    paddingLeft: 8,
  },
  appendixRow: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
  muted: { color: "#666" },
  highlight: { backgroundColor: "#f4f4f4", padding: 8, marginVertical: 6 },
});

function PageFooter() {
  return (
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `Solr Playground — Comparison report — ${pageNumber} / ${totalPages}`
      }
      fixed
    />
  );
}

function formatScore(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(3);
}

function winnerLabel(w: AiCompareSummary["winner"]): string {
  if (w === "a") return "Source A";
  if (w === "b") return "Source B";
  return "Tie";
}

function SourceBlock({ title, side }: { title: string; side: CompareReportSourceSide }) {
  return (
    <View>
      <Text style={styles.subsection}>{title}</Text>
      <Text style={styles.body}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Label: </Text>
        {side.label}
      </Text>
      <Text style={styles.body}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Strategy: </Text>
        {side.strategyNote}
      </Text>
      <Text style={[styles.body, styles.mono]}>q: {side.q}</Text>
      {side.fq.length > 0 && (
        <Text style={[styles.body, styles.mono]}>
          fq: {side.fq.join(" | ")}
        </Text>
      )}
      {side.bq.length > 0 && (
        <Text style={[styles.body, styles.mono]}>
          bq: {side.bq.join(" | ")}
        </Text>
      )}
      <Text style={[styles.body, styles.mono]}>Summary: {side.planSummary}</Text>
    </View>
  );
}

function MetricsTable({ metrics }: { metrics: CompareMetricsResult }) {
  const { sideA, sideB } = metrics;
  const rows: { label: string; a: string; b: string }[] = [
    { label: "Label", a: sideA.label, b: sideB.label },
    { label: "Query", a: sideA.qSummary, b: sideB.qSummary },
    {
      label: "Total hits",
      a: sideA.numFound.toLocaleString(),
      b: sideB.numFound.toLocaleString(),
    },
    {
      label: "Fields",
      a: String(sideA.selectedFieldCount),
      b: String(sideB.selectedFieldCount),
    },
    {
      label: "Solr QTime",
      a: sideA.qTime != null ? `${sideA.qTime}ms` : "—",
      b: sideB.qTime != null ? `${sideB.qTime}ms` : "—",
    },
    {
      label: "Wall time",
      a: `${sideA.wallTimeMs.toFixed(0)}ms`,
      b: `${sideB.wallTimeMs.toFixed(0)}ms`,
    },
    {
      label: "Max score",
      a: formatScore(sideA.maxScore),
      b: formatScore(sideB.maxScore),
    },
    {
      label: "Avg score (top 10)",
      a: formatScore(sideA.avgScoreTop10),
      b: formatScore(sideB.avgScoreTop10),
    },
  ];

  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={styles.colMetric}>Metric</Text>
        <Text style={styles.colA}>Source A</Text>
        <Text style={styles.colB}>Source B</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.tableRow}>
          <Text style={styles.colMetric}>{row.label}</Text>
          <Text style={styles.colA}>{row.a}</Text>
          <Text style={styles.colB}>{row.b}</Text>
        </View>
      ))}
    </View>
  );
}

function AppendixList({
  title,
  docs,
}: {
  title: string;
  docs: SlimCompareDoc[];
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {docs.length === 0 ? (
        <Text style={styles.body}>No results in top 10.</Text>
      ) : (
        docs.map((doc) => {
          const snippetKeys = Object.keys(doc.snippets);
          const snippetLine =
            snippetKeys.length > 0
              ? snippetKeys
                  .slice(0, 2)
                  .map((k) => `${k}: ${doc.snippets[k]}`)
                  .join(" · ")
              : null;
          return (
            <View key={`${doc.rank}-${doc.id}`} style={styles.appendixRow}>
              <Text style={styles.body}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  #{doc.rank}
                </Text>{" "}
                {doc.id}
                {doc.score != null ? ` — score ${doc.score.toFixed(3)}` : ""}
              </Text>
              {snippetLine ? (
                <Text style={[styles.body, styles.muted]}>{snippetLine}</Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

function CoverPage({ data }: { data: CompareReportPayload }) {
  const generated = new Date(data.generatedAt).toLocaleString();
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.coverTitle}>{data.productName}</Text>
      <Text style={styles.coverSubtitle}>
        Search comparison evaluation report
      </Text>
      <View style={styles.coverMeta}>
        <Text>Generated: {generated}</Text>
        <Text>Core: {data.core}</Text>
        <Text>Endpoint: {data.endpointLabel}</Text>
        <Text>Shared search: {data.sharedSearch || "(empty)"}</Text>
      </View>
      <PageFooter />
    </Page>
  );
}

function IntroductionPage({ data }: { data: CompareReportPayload }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Introduction</Text>
      <Text style={styles.body}>
        This report compares two Solr query setups (Source A and Source B)
        executed against the same core with an identical shared search term.
        Source A and Source B may differ in field selection, filters, boosts,
        and parser settings.
      </Text>
      <SourceBlock title="Source A" side={data.sourceA} />
      <SourceBlock title="Source B" side={data.sourceB} />
      <PageFooter />
    </Page>
  );
}

function TechnicalSummaryPage({ data }: { data: CompareReportPayload }) {
  const { metrics, overlap, heuristics } = {
    metrics: data.metrics,
    overlap: data.metrics.overlap,
    heuristics: data.metrics.heuristics,
  };

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Technical comparison summary</Text>
      <MetricsTable metrics={metrics} />
      <Text style={styles.subsection}>Overlap and heuristics</Text>
      <Text style={styles.bullet}>
        Overlap: {overlap.overlapCount}/10 (
        {overlap.overlapPercent.toFixed(0)}%)
      </Text>
      <Text style={styles.bullet}>
        Jaccard (top 10): {(overlap.jaccardTop10 * 100).toFixed(0)}%
      </Text>
      <Text style={styles.bullet}>Only in A: {overlap.onlyInA}</Text>
      <Text style={styles.bullet}>Only in B: {overlap.onlyInB}</Text>
      <Text style={styles.bullet}>
        Avg rank shift (shared):{" "}
        {overlap.avgRankDisplacement != null
          ? overlap.avgRankDisplacement.toFixed(1)
          : "—"}
      </Text>
      <Text style={styles.bullet}>
        Score ratio (A/B max):{" "}
        {heuristics.topScoreRatio != null
          ? heuristics.topScoreRatio.toFixed(2)
          : "—"}
      </Text>
      <Text style={styles.subsection}>Notes</Text>
      {metrics.hints.map((h) => (
        <Text key={h} style={styles.bullet}>
          • {h}
        </Text>
      ))}
      <PageFooter />
    </Page>
  );
}

function AiSummaryPage({ data }: { data: CompareReportPayload }) {
  const ai = data.ai;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>AI-generated summary</Text>
      {!ai ? (
        <Text style={styles.body}>
          AI evaluation was not performed for this comparison. Run Evaluate
          relevance (AI) on the Compare tab before exporting to include an AI
          verdict and narrative.
        </Text>
      ) : (
        <View>
          <View style={styles.highlight}>
            <Text style={styles.body}>
              Verdict: {winnerLabel(ai.winner)} ({ai.confidence} confidence)
            </Text>
          </View>
          {ai.summary ? <Text style={styles.body}>{ai.summary}</Text> : null}
          {ai.reasons.length > 0 && (
            <View>
              <Text style={styles.subsection}>Why</Text>
              {ai.reasons.map((r) => (
                <Text key={r} style={styles.bullet}>
                  • {r}
                </Text>
              ))}
            </View>
          )}
          {ai.metricsInterpretation.length > 0 && (
            <View>
              <Text style={styles.subsection}>Metrics interpretation</Text>
              {ai.metricsInterpretation.map((m) => (
                <Text key={m} style={styles.bullet}>
                  • {m}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.body}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Source A: </Text>
            {ai.perSideNotes.a}
          </Text>
          <Text style={styles.body}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Source B: </Text>
            {ai.perSideNotes.b}
          </Text>
          {ai.caveats.length > 0 && (
            <Text style={[styles.body, styles.muted]}>
              {ai.caveats.join(" ")}
            </Text>
          )}
        </View>
      )}
      <PageFooter />
    </Page>
  );
}

function AppendixPage({ data }: { data: CompareReportPayload }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Appendix — research results</Text>
      <Text style={styles.body}>
        Top 10 documents per side (collapsed: rank, document id, score, and a
        short field snippet where available).
      </Text>
      <AppendixList title="Source A — top results" docs={data.appendixA} />
      <AppendixList title="Source B — top results" docs={data.appendixB} />
      <PageFooter />
    </Page>
  );
}

export function CompareReportDocument({
  data,
}: {
  data: CompareReportPayload;
}) {
  return (
    <Document title="Search comparison evaluation report">
      <CoverPage data={data} />
      <IntroductionPage data={data} />
      <TechnicalSummaryPage data={data} />
      <AiSummaryPage data={data} />
      <AppendixPage data={data} />
    </Document>
  );
}
