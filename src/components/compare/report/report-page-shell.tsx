import type { ReactNode } from "react";
import { Page, Text, View } from "@react-pdf/renderer";
import { ReportFooter } from "@/components/compare/report/report-footer";
import { reportSpacing, reportStyles } from "@/components/compare/report-theme";

export function ReportPageShell({
  productName,
  sectionTitle,
  showHeader = true,
  children,
}: {
  productName: string;
  sectionTitle?: string;
  showHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <Page size="A4" style={reportStyles.page}>
      <View style={reportStyles.accentBar} />
      {showHeader && sectionTitle ? (
        <View style={reportStyles.pageHeader}>
          <Text style={reportStyles.pageHeaderProduct}>{productName}</Text>
          <Text style={reportStyles.pageHeaderTitle}>{sectionTitle}</Text>
        </View>
      ) : null}
      {children}
      <ReportFooter productName={productName} />
    </Page>
  );
}

export function CoverPageShell({
  productName,
  children,
}: {
  productName: string;
  children: ReactNode;
}) {
  return (
    <Page
      size="A4"
      style={[
        reportStyles.page,
        { paddingTop: reportSpacing.pagePaddingTop + 8 },
      ]}
    >
      <View style={reportStyles.accentBar} />
      {children}
      <ReportFooter productName={productName} />
    </Page>
  );
}
