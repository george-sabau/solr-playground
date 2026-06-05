import { Text, View } from "@react-pdf/renderer";
import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import { reportStyles } from "@/components/compare/report-theme";

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={reportStyles.chip}>
      <Text style={reportStyles.chipLabel}>{label}</Text>
      <Text style={reportStyles.chipValue}>{value}</Text>
    </View>
  );
}

export function StatChipRow({ metrics }: { metrics: CompareMetricsResult }) {
  const { overlap, heuristics } = metrics;
  return (
    <View style={reportStyles.chipGrid}>
      <StatChip
        label="Overlap"
        value={`${overlap.overlapCount}/10 (${overlap.overlapPercent.toFixed(0)}%)`}
      />
      <StatChip
        label="Jaccard (top 10)"
        value={`${(overlap.jaccardTop10 * 100).toFixed(0)}%`}
      />
      <StatChip label="Only in A" value={String(overlap.onlyInA)} />
      <StatChip label="Only in B" value={String(overlap.onlyInB)} />
      <StatChip
        label="Avg rank shift"
        value={
          overlap.avgRankDisplacement != null
            ? overlap.avgRankDisplacement.toFixed(1)
            : "—"
        }
      />
      <StatChip
        label="Score ratio (A/B)"
        value={
          heuristics.topScoreRatio != null
            ? heuristics.topScoreRatio.toFixed(2)
            : "—"
        }
      />
    </View>
  );
}
