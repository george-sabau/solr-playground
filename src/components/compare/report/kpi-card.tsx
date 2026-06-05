import type { ReactNode } from "react";
import { Text, View } from "@react-pdf/renderer";
import { reportStyles } from "@/components/compare/report-theme";

export function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={reportStyles.kpiCard}>
      <Text style={reportStyles.kpiLabel}>{label}</Text>
      <Text style={reportStyles.kpiValue}>{value}</Text>
    </View>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <View style={reportStyles.kpiGrid}>{children}</View>;
}
