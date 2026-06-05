import { Document, Text, View } from "@react-pdf/renderer";
import { AppendixList } from "@/components/compare/report/appendix-list";
import { KpiCard, KpiGrid } from "@/components/compare/report/kpi-card";
import { MetricsTable } from "@/components/compare/report/metrics-table";
import { registerReportFonts } from "@/components/compare/report/register-report-fonts";
import { resolveReportCopy } from "@/components/compare/report/report-copy";
import {
  CoverPageShell,
  ReportPageShell,
} from "@/components/compare/report/report-page-shell";
import { SourceCard } from "@/components/compare/report/source-card";
import { StatChipRow } from "@/components/compare/report/stat-chip-row";
import {
  AiSectionCard,
  BusinessRecommendationCard,
  SideNote,
  VerdictCard,
} from "@/components/compare/report/verdict-card";
import { reportStyles } from "@/components/compare/report-theme";
import type { CompareReportPayload } from "@/lib/compare/report-payload";

registerReportFonts();

function CoverPage({ data }: { data: CompareReportPayload }) {
  const copy = resolveReportCopy(data);
  const generated = new Date(data.generatedAt).toLocaleString();
  const searchDisplay = data.sharedSearch.trim() || "(empty)";
  return (
    <CoverPageShell productName={data.productName}>
      <Text style={reportStyles.coverTitle}>{data.productName}</Text>
      <Text style={reportStyles.coverSubtitle}>{copy.coverSubtitle}</Text>
      <Text style={reportStyles.coverContext}>{copy.coverContext}</Text>
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
  const copy = resolveReportCopy(data);
  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle={copy.introductionTitle}
    >
      <Text style={reportStyles.body}>{copy.introductionLead}</Text>
      <SourceCard
        title={copy.sourceATitle}
        side={data.sourceA}
        description={copy.sourceA.description || undefined}
        approachNote={copy.sourceA.approachNote}
        showTechnicalQueries={copy.sourceA.showTechnicalQueries}
      />
      <SourceCard
        title={copy.sourceBTitle}
        side={data.sourceB}
        description={copy.sourceB.description || undefined}
        approachNote={copy.sourceB.approachNote}
        showTechnicalQueries={copy.sourceB.showTechnicalQueries}
      />
    </ReportPageShell>
  );
}

function TechnicalSummaryPage({ data }: { data: CompareReportPayload }) {
  const copy = resolveReportCopy(data);
  const { metrics } = data;
  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle={copy.metricsSectionTitle}
    >
      {copy.isBusiness && copy.findingsSummary ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={reportStyles.body}>{copy.findingsSummary}</Text>
          {copy.findingBullets?.map((b) => (
            <Text key={b} style={reportStyles.bullet}>
              • {b}
            </Text>
          ))}
        </View>
      ) : null}
      <MetricsTable metrics={metrics} />
      <Text style={reportStyles.subsection}>{copy.overlapSectionTitle}</Text>
      <StatChipRow metrics={metrics} />
      <Text style={reportStyles.subsection}>{copy.notesSectionTitle}</Text>
      {metrics.hints.map((h) => (
        <Text key={h} style={reportStyles.bullet}>
          • {h}
        </Text>
      ))}
    </ReportPageShell>
  );
}

function AiSummaryPage({ data }: { data: CompareReportPayload }) {
  const copy = resolveReportCopy(data);
  const ai = data.ai;

  if (copy.isBusiness) {
    const rec = copy.recommendation;
    return (
      <ReportPageShell
        productName={data.productName}
        sectionTitle={copy.aiSectionTitle}
      >
        {!rec ? (
          <View style={reportStyles.callout}>
            <Text style={reportStyles.body}>{copy.aiNotRunMessage}</Text>
          </View>
        ) : (
          <View>
            <BusinessRecommendationCard recommendation={rec} />
            {rec.reasons.length > 0 && (
              <AiSectionCard title="Why">
                {rec.reasons.map((r) => (
                  <Text key={r} style={reportStyles.bullet}>
                    • {r}
                  </Text>
                ))}
              </AiSectionCard>
            )}
            <AiSectionCard title="Per-side notes">
              <SideNote label={data.sourceA.label} text={rec.sideANote} />
              <SideNote label={data.sourceB.label} text={rec.sideBNote} />
            </AiSectionCard>
            {rec.caveats.length > 0 && (
              <Text style={[reportStyles.bodyMuted, { marginTop: 8 }]}>
                {rec.caveats.join(" ")}
              </Text>
            )}
          </View>
        )}
      </ReportPageShell>
    );
  }

  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle={copy.aiSectionTitle}
    >
      {!ai ? (
        <View style={reportStyles.callout}>
          <Text style={reportStyles.body}>{copy.aiNotRunMessage}</Text>
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
  const copy = resolveReportCopy(data);
  return (
    <ReportPageShell
      productName={data.productName}
      sectionTitle={copy.appendixTitle}
    >
      <Text style={reportStyles.bodyMuted}>{copy.appendixIntro}</Text>
      <AppendixList
        title={copy.appendixSourceATitle}
        docs={data.appendixA}
      />
      <AppendixList
        title={copy.appendixSourceBTitle}
        docs={data.appendixB}
      />
    </ReportPageShell>
  );
}

export function CompareReportDocument({
  data,
}: {
  data: CompareReportPayload;
}) {
  const copy = resolveReportCopy(data);
  const docTitle = copy.isBusiness
    ? "Search strategy comparison — executive summary"
    : "Search comparison evaluation report";

  return (
    <Document title={docTitle}>
      <CoverPage data={data} />
      <IntroductionPage data={data} />
      <TechnicalSummaryPage data={data} />
      <AiSummaryPage data={data} />
      <AppendixPage data={data} />
    </Document>
  );
}
