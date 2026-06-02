import type { SchemaDynamicField } from "@/types/solr";

export interface DynamicMatch {
  rule: SchemaDynamicField;
  matchedSegment: string;
}

function patternMatches(pattern: string, name: string): string | null {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    if (name.startsWith(prefix) && name.length > prefix.length) {
      return name.slice(prefix.length);
    }
    return null;
  }
  if (pattern.startsWith("*")) {
    const suffix = pattern.slice(1);
    if (name.endsWith(suffix) && name.length > suffix.length) {
      return name.slice(0, name.length - suffix.length);
    }
    return null;
  }
  return name === pattern ? "" : null;
}

export function matchDynamicRule(
  name: string,
  rules: SchemaDynamicField[]
): DynamicMatch | null {
  let best: { rule: SchemaDynamicField; matchedSegment: string; specificity: number } | null = null;
  for (const rule of rules) {
    const segment = patternMatches(rule.name, name);
    if (segment === null) continue;
    const specificity = rule.name.length;
    if (!best || specificity > best.specificity) {
      best = { rule, matchedSegment: segment, specificity };
    }
  }
  if (!best) return null;
  return { rule: best.rule, matchedSegment: best.matchedSegment };
}
