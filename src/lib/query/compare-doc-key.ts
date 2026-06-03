import type { SolrDoc } from "@/types/solr";

/** Stable key for overlap / rank comparison across result lists. */
export function getDocKey(doc: SolrDoc, index: number): string {
  if (doc.id != null && String(doc.id).length > 0) {
    return String(doc.id);
  }
  return `__noid_${index}`;
}
