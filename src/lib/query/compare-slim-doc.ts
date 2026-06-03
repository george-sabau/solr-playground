import type { SolrDoc, SolrFieldValue } from "@/types/solr";

const SYSTEM_FIELDS = new Set([
  "_version_",
  "_root_",
  "_nest_path_",
  "_text_",
  "score",
]);

function isInternalField(name: string): boolean {
  return (
    SYSTEM_FIELDS.has(name) ||
    (name.startsWith("_") && name.endsWith("_"))
  );
}

function formatSnippet(v: SolrFieldValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    const head = v.slice(0, 3).map((x) => String(x));
    return v.length > 3 ? `${head.join(", ")}…` : head.join(", ");
  }
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

export interface SlimCompareDoc {
  rank: number;
  id: string;
  score?: number;
  snippets: Record<string, string>;
}

export function toSlimCompareDocs(
  docs: SolrDoc[],
  fieldOrder: string[],
  maxFields = 5
): SlimCompareDoc[] {
  return docs.map((doc, i) => {
    const snippets: Record<string, string> = {};
    let count = 0;
    for (const name of fieldOrder) {
      if (count >= maxFields) break;
      if (name === "id" || name === "score" || isInternalField(name)) continue;
      const v = doc[name];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      snippets[name] = formatSnippet(v);
      count++;
    }
    return {
      rank: i + 1,
      id: doc.id != null ? String(doc.id) : `row-${i + 1}`,
      score: typeof doc.score === "number" ? doc.score : undefined,
      snippets,
    };
  });
}
