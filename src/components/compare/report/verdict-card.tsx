import type { ReactNode } from "react";
import { Text, View } from "@react-pdf/renderer";
import type { AiCompareSummary } from "@/lib/ai/compare/types";
import { reportFonts, reportStyles } from "@/components/compare/report-theme";

function winnerLabel(w: AiCompareSummary["winner"]): string {
  if (w === "a") return "Source A";
  if (w === "b") return "Source B";
  return "Tie";
}

export function VerdictCard({ ai }: { ai: AiCompareSummary }) {
  const isTie = ai.winner === "tie";
  return (
    <View
      style={
        isTie
          ? [reportStyles.verdictCard, reportStyles.verdictCardTie]
          : reportStyles.verdictCard
      }
    >
      <Text
        style={
          isTie
            ? [reportStyles.verdictTitle, reportStyles.verdictTitleTie]
            : reportStyles.verdictTitle
        }
      >
        AI verdict: {winnerLabel(ai.winner)}
      </Text>
      <Text style={reportStyles.confidencePill}>{ai.confidence} confidence</Text>
      {ai.summary ? (
        <Text style={[reportStyles.body, { marginBottom: 0 }]}>{ai.summary}</Text>
      ) : null}
    </View>
  );
}

export function AiSectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={[reportStyles.card, { marginTop: 8 }]}>
      <Text style={[reportStyles.subsection, { marginTop: 0 }]}>{title}</Text>
      {children}
    </View>
  );
}

export function SideNote({ label, text }: { label: string; text: string }) {
  return (
    <Text style={reportStyles.body}>
      <Text style={{ fontFamily: reportFonts.sansBold }}>{label}: </Text>
      {text}
    </Text>
  );
}
