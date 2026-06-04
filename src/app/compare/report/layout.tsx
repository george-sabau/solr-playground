import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparison report",
};

export default function CompareReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
