import type {
  BuilderFieldConfig,
  BuilderState,
  ClassicQueryState,
  EdismaxSettings,
  FieldMatcher,
  MatchMode,
  QueryParserMode,
  SearchPlan,
} from "@/lib/query/types";
import {
  DEFAULT_FUZZY_DISTANCE,
  DEFAULT_MIN_QUERY_LENGTH,
} from "@/lib/query/types";

const LUCENE_SPECIAL = /[+\-&|!(){}\[\]^"~*?:\\/]/g;

export function escapeLuceneTerm(value: string): string {
  return value.replace(LUCENE_SPECIAL, "\\$&");
}

export function escapeQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function resolveMinLength(
  matcher: FieldMatcher,
  field: BuilderFieldConfig
): number {
  return (
    matcher.minLength ?? field.minLength ?? DEFAULT_MIN_QUERY_LENGTH
  );
}

export function effectiveBoost(boost: number | undefined): number {
  if (boost === undefined || boost <= 0) return 1;
  return boost;
}

function compileMatcherExpr(
  fieldName: string,
  matcher: FieldMatcher,
  searchText: string
): string {
  const raw = searchText.trim();
  const field = escapeLuceneTerm(fieldName);
  const mode = matcher.mode;
  const fuzzy = Math.max(
    0,
    Math.min(2, matcher.fuzzyDistance ?? DEFAULT_FUZZY_DISTANCE)
  );

  let expr: string;
  switch (mode) {
    case "phrase":
      expr = `${field}:"${escapeQuoted(raw)}"`;
      break;
    case "exact":
      expr = `${field}:"${escapeQuoted(raw)}"`;
      break;
    case "wildcard": {
      const v = raw.endsWith("*") ? raw.slice(0, -1) : raw;
      expr = `${field}:${escapeLuceneTerm(v)}*`;
      break;
    }
    case "prefix":
      expr = `${field}:${escapeLuceneTerm(raw)}*`;
      break;
    case "fuzzy":
      expr = `${field}:${escapeLuceneTerm(raw)}~${fuzzy}`;
      break;
    case "term":
    default:
      if (/\s/.test(raw)) {
        expr = `${field}:"${escapeQuoted(raw)}"`;
      } else {
        expr = `${field}:${escapeLuceneTerm(raw)}`;
      }
  }

  const boost = effectiveBoost(matcher.boost);
  if (boost !== 1) expr += `^${boost}`;
  if (matcher.prohibited) return `-${expr}`;
  if (matcher.required) return `+${expr}`;
  return expr;
}

function compileMatcherClause(
  field: BuilderFieldConfig,
  matcher: FieldMatcher,
  searchText: string
): string | null {
  const raw = searchText.trim();
  if (!raw) return null;
  const minLen = resolveMinLength(matcher, field);
  if (raw.length < minLen) return null;
  return compileMatcherExpr(field.field, matcher, raw);
}

function compileFieldGroup(
  field: BuilderFieldConfig,
  searchText: string
): string {
  const parts = field.matchers
    .map((m) => compileMatcherClause(field, m, searchText))
    .filter((p): p is string => p !== null);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `(${parts.join(" OR ")})`;
}

export function compileFieldsToQ(
  fields: BuilderFieldConfig[],
  searchText: string,
  options: { combineWith: "AND" | "OR" }
): string {
  const text = searchText.trim();
  if (!text) return "*:*";
  if (fields.length === 0) return text;

  const parts = fields
    .map((f) => compileFieldGroup(f, text))
    .filter((p) => p.length > 0);

  if (parts.length === 0) return "*:*";
  if (parts.length === 1) return parts[0]!;
  const join = ` ${options.combineWith} `;
  return parts.map((p) => (p.includes(" ") ? `(${p})` : p)).join(join);
}

function buildEdismaxExtra(
  parser: QueryParserMode,
  edismax: EdismaxSettings,
  qfFromFields: string,
  manualQf?: string
): Record<string, string> {
  const extra: Record<string, string> = { defType: parser };
  const qf = (manualQf?.trim() || edismax.qfOverride.trim() || qfFromFields).trim();
  if (qf && (parser === "edismax" || parser === "dismax")) {
    extra.qf = qf;
  }
  if (edismax.mm.trim()) extra.mm = edismax.mm.trim();
  if (edismax.min.trim()) {
    extra.min = edismax.min.trim();
  } else if (DEFAULT_MIN_QUERY_LENGTH > 0) {
    extra.min = String(DEFAULT_MIN_QUERY_LENGTH);
  }
  if (edismax.tie.trim()) extra.tie = edismax.tie.trim();
  return extra;
}

function qfFromFields(fields: BuilderFieldConfig[]): string {
  const seen = new Map<string, number>();
  for (const f of fields) {
    if (!f.field.trim()) continue;
    let maxBoost = 1;
    for (const m of f.matchers) {
      maxBoost = Math.max(maxBoost, effectiveBoost(m.boost));
    }
    const prev = seen.get(f.field) ?? 0;
    seen.set(f.field, Math.max(prev, maxBoost));
  }
  return [...seen.entries()]
    .map(([field, boost]) => (boost !== 1 ? `${field}^${boost}` : field))
    .join(" ");
}

export function compileBuilderSearch(
  state: BuilderState,
  parser: QueryParserMode
): SearchPlan {
  const qFromFields = compileFieldsToQ(state.fields, state.searchText, {
    combineWith: state.combineWith,
  });

  if (parser === "edismax" || parser === "dismax") {
    const text = state.searchText.trim();
    const q =
      state.fields.length > 0 && text ? qFromFields : text || "*:*";
    const extra = buildEdismaxExtra(
      parser,
      state.edismax,
      qfFromFields(state.fields)
    );
    const summary =
      text && state.fields.length > 0
        ? `"${text}" → ${state.fields.map((f) => f.field).join(", ")}`
        : q;
    return { q, extra, summary };
  }

  return {
    q: qFromFields,
    extra: { defType: "lucene" },
    summary: qFromFields,
  };
}

export function compileClassicSearch(
  state: ClassicQueryState,
  parser: QueryParserMode
): SearchPlan {
  const q = state.q.trim() || "*:*";
  const extra =
    parser === "lucene"
      ? { defType: "lucene" }
      : buildEdismaxExtra(parser, state.edismax, "", state.qf);
  return { q, extra, summary: q };
}

export function buildSelectRequestUrl(
  baseUrl: string,
  core: string,
  q: string,
  extra: Record<string, string>,
  opts?: { start?: number; rows?: number; fl?: string }
): { proxy: string; upstream: string } {
  const params = new URLSearchParams({
    q,
    wt: "json",
    indent: "true",
    fl: opts?.fl ?? "*,score",
    rows: String(opts?.rows ?? 20),
    start: String(opts?.start ?? 0),
    ...extra,
  });
  const qs = params.toString();
  const upstream = `${baseUrl.replace(/\/+$/, "")}/${core}/select?${qs}`;
  const proxy = `/api/solr/${core}/select?${qs}`;
  return { proxy, upstream };
}

export function matchModeLabel(mode: MatchMode): string {
  switch (mode) {
    case "term":
      return "Free text";
    case "phrase":
      return "Phrase";
    case "exact":
      return "Exact (quoted)";
    case "wildcard":
      return "Wildcard";
    case "prefix":
      return "Prefix";
    case "fuzzy":
      return "Fuzzy";
    default:
      return mode;
  }
}

export function describeMatcher(
  matcher: FieldMatcher,
  field: BuilderFieldConfig,
  searchText: string
): string {
  const parts: string[] = [matchModeLabel(matcher.mode)];
  if (matcher.mode === "fuzzy") {
    parts.push(
      `~${Math.max(0, Math.min(2, matcher.fuzzyDistance ?? DEFAULT_FUZZY_DISTANCE))}`
    );
  }
  const boost = effectiveBoost(matcher.boost);
  if (boost !== 1) parts.push(`^${boost}`);
  const minLen = resolveMinLength(matcher, field);
  parts.push(`min ${minLen} chars`);
  if (matcher.required) parts.push("required");
  if (matcher.prohibited) parts.push("prohibited");
  const raw = searchText.trim();
  const active = raw.length >= minLen;
  if (!active && raw.length > 0) parts.push("(skipped — query too short)");
  return parts.join(" · ");
}

export function describeFieldConfig(
  field: BuilderFieldConfig,
  searchText: string
): string {
  const matcherDesc = field.matchers
    .map((m) => describeMatcher(m, field, searchText))
    .join("; ");
  return `${field.field}: ${matcherDesc}`;
}

/** @deprecated */
export const describeClause = describeFieldConfig;

/** @deprecated */
export const compileClausesToQ = (
  fields: BuilderFieldConfig[],
  combineWith: "AND" | "OR"
) => compileFieldsToQ(fields, "", { combineWith });

export function isMatcherActive(
  matcher: FieldMatcher,
  field: BuilderFieldConfig,
  searchText: string
): boolean {
  const raw = searchText.trim();
  if (!raw) return false;
  return raw.length >= resolveMinLength(matcher, field);
}
