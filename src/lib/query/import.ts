import type {
  BuilderFieldConfig,
  BuilderState,
  ClauseOperator,
  MatchMode,
  QueryParserMode,
} from "@/lib/query/types";
import {
  DEFAULT_EDISMAX,
  DEFAULT_FUZZY_DISTANCE,
  DEFAULT_MATCHER_BOOST,
  DEFAULT_MIN_QUERY_LENGTH,
  createFieldConfig,
  createMatcher,
} from "@/lib/query/types";

export interface ImportBuilderResult {
  parser: QueryParserMode;
  state: BuilderState;
  warnings: string[];
}

export class ImportBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportBuilderError";
  }
}

interface ParsedClause {
  field: string;
  value: string;
  mode: MatchMode;
  boost: number;
  fuzzyDistance: number;
  required: boolean;
  prohibited: boolean;
}

function unescapeLucene(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

function parseSolrParams(input: string): URLSearchParams {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ImportBuilderError("Paste a Solr select URL or query string.");
  }
  try {
    if (trimmed.startsWith("?")) {
      return new URL(`http://local/${trimmed}`).searchParams;
    }
    if (!trimmed.includes("://") && trimmed.includes("=")) {
      return new URL(`http://local/?${trimmed}`).searchParams;
    }
    return new URL(trimmed).searchParams;
  } catch {
    throw new ImportBuilderError("Could not parse URL. Paste a full Solr select URL.");
  }
}

function parseDefType(value: string | null): QueryParserMode {
  const v = (value ?? "lucene").toLowerCase();
  if (v === "edismax" || v === "dismax" || v === "lucene") return v;
  throw new ImportBuilderError(`Unsupported defType: ${value}`);
}

function matchesWordAt(text: string, index: number, word: string): boolean {
  const before = index === 0 ? " " : text[index - 1]!;
  const after = index + word.length >= text.length ? " " : text[index + word.length]!;
  if (!/\s/.test(before) && before !== "(") return false;
  if (!/\s/.test(after) && after !== ")") return false;
  return text.slice(index, index + word.length).toUpperCase() === word;
}

function splitAtDepthZero(text: string, op: ClauseOperator): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "\\" && inQuote) {
      i++;
      continue;
    }
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;

    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && matchesWordAt(text, i, op)) {
      parts.push(text.slice(start, i).trim());
      i += op.length - 1;
      start = i + 1;
    }
  }

  parts.push(text.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}

function detectTopLevelOperator(q: string): ClauseOperator | null {
  let depth = 0;
  let inQuote = false;
  let foundAnd = false;
  let foundOr = false;

  for (let i = 0; i < q.length; i++) {
    const c = q[i]!;
    if (c === "\\" && inQuote) {
      i++;
      continue;
    }
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;

    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0) {
      if (matchesWordAt(q, i, "AND")) foundAnd = true;
      if (matchesWordAt(q, i, "OR")) foundOr = true;
    }
  }

  if (foundAnd && foundOr) {
    throw new ImportBuilderError(
      "Mixed AND/OR at the top level is not supported by the builder."
    );
  }
  if (foundAnd) return "AND";
  if (foundOr) return "OR";
  return null;
}

function stripOuterParens(segment: string): string {
  let s = segment.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") {
        depth--;
        if (depth === 0 && i < s.length - 1) {
          wrapsAll = false;
          break;
        }
      }
    }
    if (!wrapsAll) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseFieldClause(raw: string): ParsedClause {
  let s = raw.trim();
  if (!s) throw new ImportBuilderError("Empty field clause.");

  let required = false;
  let prohibited = false;
  if (s.startsWith("+")) {
    required = true;
    s = s.slice(1).trim();
  } else if (s.startsWith("-")) {
    prohibited = true;
    s = s.slice(1).trim();
  }

  const colon = findFieldColon(s);
  if (colon < 0) {
    throw new ImportBuilderError(`Expected field:value syntax, got: ${raw}`);
  }

  const field = unescapeLucene(s.slice(0, colon).trim());
  let rest = s.slice(colon + 1).trim();
  if (!field) throw new ImportBuilderError(`Missing field name in: ${raw}`);

  let boost = DEFAULT_MATCHER_BOOST;
  const boostMatch = rest.match(/(\^[\d.]+)$/);
  if (boostMatch) {
    boost = parseFloat(boostMatch[1]!.slice(1)) || DEFAULT_MATCHER_BOOST;
    rest = rest.slice(0, -boostMatch[1]!.length).trim();
  }

  if (rest.startsWith('"')) {
    const end = findClosingQuote(rest, 0);
    if (end < 0) throw new ImportBuilderError(`Unclosed quote in: ${raw}`);
    const value = unescapeLucene(rest.slice(1, end));
    return {
      field,
      value,
      mode: "phrase",
      boost,
      fuzzyDistance: DEFAULT_FUZZY_DISTANCE,
      required,
      prohibited,
    };
  }

  const fuzzyMatch = rest.match(/^(.+?)~(\d+)$/);
  if (fuzzyMatch) {
    return {
      field,
      value: unescapeLucene(fuzzyMatch[1]!),
      mode: "fuzzy",
      boost,
      fuzzyDistance: Math.max(
        0,
        Math.min(2, Number(fuzzyMatch[2]) || DEFAULT_FUZZY_DISTANCE)
      ),
      required,
      prohibited,
    };
  }

  if (rest.endsWith("*")) {
    return {
      field,
      value: unescapeLucene(rest.slice(0, -1)),
      mode: "prefix",
      boost,
      fuzzyDistance: DEFAULT_FUZZY_DISTANCE,
      required,
      prohibited,
    };
  }

  return {
    field,
    value: unescapeLucene(rest),
    mode: "term",
    boost,
    fuzzyDistance: DEFAULT_FUZZY_DISTANCE,
    required,
    prohibited,
  };
}

function findFieldColon(s: string): number {
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) return i;
  }
  return -1;
}

function findClosingQuote(s: string, start: number): number {
  for (let i = start + 1; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === '"') return i;
  }
  return -1;
}

function parseFieldGroup(segment: string): { field: string; clauses: ParsedClause[] } {
  const inner = stripOuterParens(segment);
  const innerOp = detectTopLevelOperator(inner);

  let clauseStrings: string[];
  if (innerOp === "OR") {
    clauseStrings = splitAtDepthZero(inner, "OR");
  } else if (innerOp === "AND") {
    throw new ImportBuilderError(
      "Matchers on the same field must be combined with OR, not AND."
    );
  } else {
    clauseStrings = [inner];
  }

  const clauses = clauseStrings.map(parseFieldClause);
  const field = clauses[0]!.field;
  if (!clauses.every((c) => c.field === field)) {
    throw new ImportBuilderError(
      "OR groups must use the same field (one field, multiple matchers)."
    );
  }
  return { field, clauses };
}

function looksLikeFieldQuery(q: string): boolean {
  return /(?:^|[\s(])[+\-]?[\w.-]+:/.test(q);
}

function parseFieldQuery(q: string): {
  searchText: string;
  combineWith: ClauseOperator;
  fieldGroups: { field: string; clauses: ParsedClause[] }[];
} {
  const trimmed = q.trim();
  if (!trimmed || trimmed === "*:*") {
    return { searchText: "", combineWith: "OR", fieldGroups: [] };
  }

  const topOp = detectTopLevelOperator(trimmed);
  const combineWith = topOp ?? "OR";
  const segments =
    topOp === null ? [trimmed] : splitAtDepthZero(trimmed, topOp);

  const fieldGroups = segments.map(parseFieldGroup);
  const values = new Set(
    fieldGroups.flatMap((g) => g.clauses.map((c) => c.value))
  );

  if (values.size > 1) {
    throw new ImportBuilderError(
      "All field clauses must use the same search value (builder uses one shared search box)."
    );
  }

  const searchText = values.size === 1 ? [...values][0]! : "";
  return { searchText, combineWith, fieldGroups };
}

function parseQf(qf: string): { field: string; boost: number }[] {
  return qf
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const m = token.match(/^([^\\^]+)(?:\^([\d.]+))?$/);
      if (!m) throw new ImportBuilderError(`Invalid qf token: ${token}`);
      return {
        field: m[1]!.trim(),
        boost: m[2] ? parseFloat(m[2]) || DEFAULT_MATCHER_BOOST : DEFAULT_MATCHER_BOOST,
      };
    });
}

function clausesToMatchers(clauses: ParsedClause[]) {
  return clauses.map((c) =>
    createMatcher(c.mode, {
      boost: c.boost,
      fuzzyDistance: c.fuzzyDistance,
      required: c.required,
      prohibited: c.prohibited,
    })
  );
}

function buildFieldConfigs(
  fieldGroups: { field: string; clauses: ParsedClause[] }[]
): BuilderFieldConfig[] {
  return fieldGroups.map((g) => {
    const base = createFieldConfig(g.field);
    return { ...base, matchers: clausesToMatchers(g.clauses) };
  });
}

function importFromEdismax(
  q: string,
  params: URLSearchParams,
  warnings: string[]
): BuilderState {
  const edismax = { ...DEFAULT_EDISMAX };
  const mm = params.get("mm");
  const min = params.get("min");
  const tie = params.get("tie");
  const qf = params.get("qf") ?? "";

  if (mm) edismax.mm = mm;
  if (tie) edismax.tie = tie;
  if (min && min !== String(DEFAULT_MIN_QUERY_LENGTH)) {
    edismax.min = min;
  }

  if (looksLikeFieldQuery(q)) {
    const parsed = parseFieldQuery(q);
    return {
      searchText: parsed.searchText,
      combineWith: parsed.combineWith,
      fields: buildFieldConfigs(parsed.fieldGroups),
      edismax,
    };
  }

  if (!qf.trim()) {
    warnings.push("No qf parameter — imported search text only.");
    return {
      searchText: q.trim(),
      combineWith: "OR",
      fields: [],
      edismax,
    };
  }

  const qfFields = parseQf(qf);
  const fields = qfFields.map(({ field, boost }) => {
    const base = createFieldConfig(field);
    return {
      ...base,
      matchers: [createMatcher("term", { boost })],
    };
  });

  return {
    searchText: q.trim(),
    combineWith: "OR",
    fields,
    edismax,
  };
}

function importFromLucene(q: string): BuilderState {
  const parsed = parseFieldQuery(q);
  return {
    searchText: parsed.searchText,
    combineWith: parsed.combineWith,
    fields: buildFieldConfigs(parsed.fieldGroups),
    edismax: { ...DEFAULT_EDISMAX },
  };
}

/** Reverse-engineer builder state from a Solr select URL or query string. */
export function importBuilderFromSolrUrl(input: string): ImportBuilderResult {
  const params = parseSolrParams(input);
  const q = params.get("q");
  if (q === null) {
    throw new ImportBuilderError("URL has no q parameter.");
  }

  const parser = parseDefType(params.get("defType"));
  const warnings: string[] = [];

  const state =
    parser === "edismax" || parser === "dismax"
      ? importFromEdismax(q, params, warnings)
      : importFromLucene(q);

  return { parser, state, warnings };
}

/** Round-trip check: import then verify q matches (for dev). */
export function importAndVerify(
  input: string,
  compile: (state: BuilderState, parser: QueryParserMode) => string
): ImportBuilderResult & { compiledQ: string; originalQ: string } {
  const result = importBuilderFromSolrUrl(input);
  const params = parseSolrParams(input);
  const originalQ = params.get("q") ?? "";
  const compiledQ = compile(result.state, result.parser);
  return { ...result, compiledQ, originalQ };
}
