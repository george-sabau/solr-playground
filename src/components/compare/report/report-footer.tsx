import { Text } from "@react-pdf/renderer";
import { reportStyles } from "@/components/compare/report-theme";

export function ReportFooter({ productName }: { productName: string }) {
  return (
    <Text
      style={reportStyles.footer}
      render={({ pageNumber, totalPages }) =>
        `${productName} · Comparison report · ${pageNumber} / ${totalPages}`
      }
      fixed
    />
  );
}
