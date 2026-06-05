import { Text, View } from "@react-pdf/renderer";
import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import { reportColors, reportFonts, reportStyles } from "@/components/compare/report-theme";

function formatScore(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(3);
}

export function MetricsTable({ metrics }: { metrics: CompareMetricsResult }) {
  const { sideA, sideB } = metrics;
  const rows: {
    label: string;
    a: string;
    b: string;
    highlight?: boolean;
  }[] = [
    { label: "Label", a: sideA.label, b: sideB.label },
    { label: "Query", a: sideA.qSummary, b: sideB.qSummary },
    {
      label: "Total hits",
      a: sideA.numFound.toLocaleString(),
      b: sideB.numFound.toLocaleString(),
      highlight: true,
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
    <View style={reportStyles.tableWrap}>
      <View style={reportStyles.tableHeader}>
        <Text style={reportStyles.colMetric}>Metric</Text>
        <Text style={reportStyles.colA}>Source A</Text>
        <Text style={reportStyles.colB}>Source B</Text>
      </View>
      {rows.map((row) => (
        <View
          key={row.label}
          style={
            row.highlight
              ? [reportStyles.tableRow, reportStyles.tableRowHighlight]
              : reportStyles.tableRow
          }
        >
          <Text
            style={
              row.highlight
                ? [
                    reportStyles.colMetric,
                    {
                      fontFamily: reportFonts.sansBold,
                      color: reportColors.accentMuted,
                    },
                  ]
                : reportStyles.colMetric
            }
          >
            {row.label}
          </Text>
          <Text
            style={
              row.highlight
                ? [reportStyles.colA, { fontFamily: reportFonts.sansBold }]
                : reportStyles.colA
            }
          >
            {row.a}
          </Text>
          <Text
            style={
              row.highlight
                ? [reportStyles.colB, { fontFamily: reportFonts.sansBold }]
                : reportStyles.colB
            }
          >
            {row.b}
          </Text>
        </View>
      ))}
    </View>
  );
}
