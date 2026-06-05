import { Document, Text, View } from "@react-pdf/renderer";
import { AppendixList } from "@/components/compare/report/appendix-list";
import { KpiCard, KpiGrid } from "@/components/compare/report/kpi-card";
import { MetricsTable } from "@/components/compare/report/metrics-table";
import { registerReportFonts } from "@/components/compare/report/register-report-fonts";
import {
  CoverPageShell,
  ReportPageShell,
} from "@/components/compare/report/report-page-shell";
import { SourceCard } from "@/components/compare/report/source-card";
import { StatChipRow } from "@/components/compare/report/stat-chip-row";
import {
  AiSectionCard,
  SideNote,
  VerdictCard,
} from "@/components/compare/report/verdict-card";
import { reportStyles } from "@/components/compare/report-theme";
import type { CompareReportPayload } from "@/lib/compare/report-payload";

registerReportFonts();

function CoverPage({ data }: { data: CompareReportPayload }) {
  const generated = new Date(data.generatedAt).toLocaleString();
  const searchDisplay = data.sharedSearch.trim() || "(empty)";
  return (
    <CoverPageShell productName={data.productName}>
      <Text style={reportStyles.coverTitle}>{data.productName}</Text>
      <Text style={reportStyles.coverSubtitle}>
        Search comparison evaluation report
      </Text>
      <Text style={reportStyles.coverContext}>
        Comparison of {data.sourceA.label} vs {data.sourceB.label} on core{" "}
        {data.core} using endpoint {data.endpointLabel}.
      </Text>
      <KpiGrid>
        <KpiCard label="Core" value={data.core} />
        <KpiCard label="Endpoint" value={data.endpointLabel} />
        <KpiCard label="Shared search" value={searchDisplay} />
        <KpiCard label="Generated" value={generated} />
      </KpiGrid>
    </CoverPageShell>
  );
}

function IntroductionPage({ data }: { data: CompareReportPayload }) {
  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle="Introduction"
    >
      <Text style={reportStyles.body}>
        This report compares two Solr query setups (Source A and Source B)
        executed against the same core with an identical shared search term.
        Source A and Source B may differ in field selection, filters, boosts,
        and parser settings.
      </Text>
      <SourceCard title="Source A" side={data.sourceA} />
      <SourceCard title="Source B" side={data.sourceB} />
    </ReportPageShell>
  );
}

function TechnicalSummaryPage({ data }: { data: CompareReportPayload }) {
  const { metrics } = data;
  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle="Technical comparison summary"
    >
      <MetricsTable metrics={metrics} />
      <Text style={reportStyles.subsection}>Overlap and heuristics</Text>
      <StatChipRow metrics={metrics} />
      <Text style={reportStyles.subsection}>Notes</Text>
      {metrics.hints.map((h) => (
        <Text key={h} style={reportStyles.bullet}>
          • {h}
        </Text>
      ))}
    </ReportPageShell>
  );
}

function AiSummaryPage({ data }: { data: CompareReportPayload }) {
  const ai = data.ai;
  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle="AI-generated summary"
    >
      {!ai ? (
        <View style={reportStyles.callout}>
          <Text style={reportStyles.body}>
            AI evaluation was not performed for this comparison. Run Evaluate
            relevance (AI) on the Compare tab before exporting to include an AI
            verdict and narrative.
          </Text>
        </View>
      ) : (
        <View>
          <VerdictCard ai={ai} />
          {ai.reasons.length > 0 && (
            <AiSectionCard title="Why">
              {ai.reasons.map((r) => (
                <Text key={r} style={reportStyles.bullet}>
                  • {r}
                </Text>
              ))}
            </AiSectionCard>
          )}
          {ai.metricsInterpretation.length > 0 && (
            <AiSectionCard title="Metrics interpretation">
              {ai.metricsInterpretation.map((m) => (
                <Text key={m} style={reportStyles.bullet}>
                  • {m}
                </Text>
              ))}
            </AiSectionCard>
          )}
          <AiSectionCard title="Per-side notes">
            <SideNote label="Source A" text={ai.perSideNotes.a} />
            <SideNote label="Source B" text={ai.perSideNotes.b} />
          </AiSectionCard>
          {ai.caveats.length > 0 && (
            <Text style={[reportStyles.bodyMuted, { marginTop: 8 }]}>
              {ai.caveats.join(" ")}
            </Text>
          )}
        </View>
      )}
    </ReportPageShell>
  );
}

function AppendixPage({ data }: { data: CompareReportPayload }) {
  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle="Appendix — research results"
    >
      <Text style={reportStyles.bodyMuted}>
        Top 10 documents per side (collapsed: rank, document id, score, and a
        short field snippet where available).
      </Text>
      <AppendixList title="Source A — top results" docs={data.appendixA} />
      <AppendixList title="Source B — top results" docs={data.appendixB} />
    </ReportPageShell>
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
