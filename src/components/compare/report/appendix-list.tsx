import { Text, View } from "@react-pdf/renderer";
import type { SlimCompareDoc } from "@/lib/query/compare-slim-doc";
import { reportStyles } from "@/components/compare/report-theme";

export function AppendixList({
  title,
  docs,
}: {
  title: string;
  docs: SlimCompareDoc[];
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={reportStyles.sectionTitle}>{title}</Text>
      {docs.length === 0 ? (
        <Text style={reportStyles.bodyMuted}>No results in top 10.</Text>
      ) : (
        docs.map((doc) => {
          const snippetKeys = Object.keys(doc.snippets);
          const snippetLine =
            snippetKeys.length > 0
              ? snippetKeys
                  .slice(0, 2)
                  .map((k) => `${k}: ${doc.snippets[k]}`)
                  .join(" · ")
              : null;
          return (
            <View key={`${doc.rank}-${doc.id}`} style={reportStyles.appendixItem}>
              <Text style={reportStyles.rankBadge}>#{doc.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={reportStyles.body}>
                  {doc.id}
                  {doc.score != null ? (
                    <Text style={reportStyles.bodyMuted}>
                      {" "}
                      · score {doc.score.toFixed(3)}
                    </Text>
                  ) : null}
                </Text>
                {snippetLine ? (
                  <Text style={reportStyles.bodyMuted}>{snippetLine}</Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
