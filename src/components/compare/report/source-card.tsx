import { Text, View } from "@react-pdf/renderer";
import type { CompareReportSourceSide } from "@/lib/compare/report-payload";
import { reportFonts, reportStyles } from "@/components/compare/report-theme";

export function SourceCard({
  title,
  side,
  description,
  approachNote,
  showTechnicalQueries = true,
}: {
  title: string;
  side: CompareReportSourceSide;
  description?: string;
  approachNote?: string;
  showTechnicalQueries?: boolean;
}) {
  const note = approachNote ?? side.strategyNote;

  return (
    <View style={[reportStyles.card, { paddingLeft: 16, position: "relative" }]}>
      <View style={reportStyles.cardAccentStripe} />
      <Text style={reportStyles.subsection}>{title}</Text>
      {showTechnicalQueries ? (
        <Text style={reportStyles.body}>
          <Text style={{ fontFamily: reportFonts.sansBold }}>{side.label}</Text>
        </Text>
      ) : null}
      {description ? (
        <Text style={reportStyles.body}>{description}</Text>
      ) : null}
      <Text style={reportStyles.bodyMuted}>{note}</Text>
      {showTechnicalQueries ? (
        <View style={reportStyles.monoBox}>
          <Text style={reportStyles.mono}>q: {side.q}</Text>
          {side.fq.length > 0 && (
            <Text style={[reportStyles.mono, { marginTop: 3 }]}>
              fq: {side.fq.join(" | ")}
            </Text>
          )}
          {side.bq.length > 0 && (
            <Text style={[reportStyles.mono, { marginTop: 3 }]}>
              bq: {side.bq.join(" | ")}
            </Text>
          )}
          <Text style={[reportStyles.mono, { marginTop: 3 }]}>
            Summary: {side.planSummary}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
