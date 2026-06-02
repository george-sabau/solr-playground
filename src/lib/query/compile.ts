import type {
  BuilderFieldConfig,
  BuilderState,
  ClassicQueryState,
  EdismaxSettings,
  MatchMode,
  QueryParserMode,
  SearchPlan,
} from "@/lib/query/types";

const LUCENE_SPECIAL = /[+\-&|!(){}\[\]^"~*?:\\/]/g;

export function escapeLuceneTerm(value: string): string {
  return value.replace(LUCENE_SPECIAL, "\\$&");
}

export function escapeQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function effectiveMode(
  field: BuilderFieldConfig,
  globalMode: MatchMode
): MatchMode {
  return field.mode ?? globalMode;
}

function effectiveFuzzy(
  field: BuilderFieldConfig,
  globalFuzzy: number,
  mode: MatchMode
): number {
  if (mode === "fuzzy") {
    return Math.max(0, Math.min(2, field.fuzzyDistance ?? globalFuzzy));
  }
  return globalFuzzy;
}

function compileFieldClause(
  field: BuilderFieldConfig,
  searchText: string,
  globalMode: MatchMode,
  globalFuzzy: number
): string {
  const raw = searchText.trim();
  if (!raw) return "";

  const fieldName = escapeLuceneTerm(field.field);
  const mode = effectiveMode(field, globalMode);
  const fuzzy = effectiveFuzzy(field, globalFuzzy, mode);

  let expr: string;
  switch (mode) {
    case "phrase":
      expr = `${fieldName}:"${escapeQuoted(raw)}"`;
      break;
    case "exact":
      expr = `${fieldName}:"${escapeQuoted(raw)}"`;
      break;
    case "wildcard": {
      const v = raw.endsWith("*") ? raw.slice(0, -1) : raw;
      expr = `${fieldName}:${escapeLuceneTerm(v)}*`;
      break;
    }
    case "prefix":
      expr = `${fieldName}:${escapeLuceneTerm(raw)}*`;
      break;
    case "fuzzy":
      expr = `${fieldName}:${escapeLuceneTerm(raw)}~${fuzzy}`;
      break;
    case "term":
    default:
      if (/\s/.test(raw)) {
        expr = `${fieldName}:"${escapeQuoted(raw)}"`;
      } else {
        expr = `${fieldName}:${escapeLuceneTerm(raw)}`;
      }
  }

  if (field.boost > 0 && field.boost !== 1) {
    expr += `^${field.boost}`;
  }
  if (field.prohibited) return `-${expr}`;
  if (field.required) return `+${expr}`;
  return expr;
}

export function compileFieldsToQ(
  fields: BuilderFieldConfig[],
  searchText: string,
  globalMode: MatchMode,
  globalFuzzy: number,
  combineWith: "AND" | "OR"
): string {
  const text = searchText.trim();
  if (!text) return "*:*";
  if (fields.length === 0) return text;

  const parts = fields
    .map((f) => compileFieldClause(f, text, globalMode, globalFuzzy))
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "*:*";
  if (parts.length === 1) return parts[0]!;
  const join = ` ${combineWith} `;
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
  if (edismax.min.trim()) extra.min = edismax.min.trim();
  if (edismax.tie.trim()) extra.tie = edismax.tie.trim();
  return extra;
}

function qfFromFields(fields: BuilderFieldConfig[]): string {
  const seen = new Map<string, number>();
  for (const f of fields) {
    if (!f.field.trim()) continue;
    const prev = seen.get(f.field) ?? 0;
    seen.set(f.field, Math.max(prev, f.boost > 0 ? f.boost : 1));
  }
  return [...seen.entries()]
    .map(([field, boost]) => (boost !== 1 ? `${field}^${boost}` : field))
    .join(" ");
}

export function compileBuilderSearch(
  state: BuilderState,
  parser: QueryParserMode
): SearchPlan {
  const text = state.searchText.trim();

  if (parser === "edismax" || parser === "dismax") {
    const q = text || "*:*";
    const extra = buildEdismaxExtra(
      parser,
      state.edismax,
      qfFromFields(state.fields)
    );
    const summary =
      text && state.fields.length > 0
        ? `"${text}" → ${state.fields.map((f) => f.field).join(", ")}`
        : text || "*:*";
    return { q, extra, summary };
  }

  const q = compileFieldsToQ(
    state.fields,
    state.searchText,
    state.globalMode,
    state.globalFuzzyDistance,
    state.combineWith
  );
  return { q, extra: { defType: "lucene" }, summary: q };
}

/** @deprecated use compileFieldsToQ */
export const compileClausesToQ = (
  fields: BuilderFieldConfig[],
  combineWith: "AND" | "OR"
) =>
  compileFieldsToQ(fields, "", "term", 1, combineWith);

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

export function describeFieldConfig(
  field: BuilderFieldConfig,
  searchText: string,
  globalMode: MatchMode,
  globalFuzzy: number
): string {
  const mode = effectiveMode(field, globalMode);
  const parts: string[] = [matchModeLabel(mode)];
  if (mode === "fuzzy") {
    parts.push(`~${effectiveFuzzy(field, globalFuzzy, mode)}`);
  }
  if (field.mode) parts.push("(field override)");
  if (field.boost !== 1) parts.push(`boost ^${field.boost}`);
  if (field.required) parts.push("required");
  if (field.prohibited) parts.push("prohibited");
  const val = searchText.trim();
  return val
    ? `${field.field} · “${val.length > 32 ? `${val.slice(0, 29)}…` : val}” · ${parts.join(" · ")}`
    : `${field.field} · ${parts.join(" · ")}`;
}

/** @deprecated use describeFieldConfig */
export const describeClause = describeFieldConfig;
