export type QueryParserMode = "lucene" | "edismax" | "dismax";

export type PlayQueryMode = "classic" | "builder";

export type MatchMode =
  | "term"
  | "phrase"
  | "exact"
  | "wildcard"
  | "prefix"
  | "fuzzy";

export type ClauseOperator = "AND" | "OR";

export const DEFAULT_MIN_QUERY_LENGTH = 3;
export const DEFAULT_MATCHER_BOOST = 1;
export const DEFAULT_FUZZY_DISTANCE = 2;

/** One match strategy for a field (a field may have several). */
export interface FieldMatcher {
  id: string;
  mode: MatchMode;
  /** Default 1 when unset or zero. */
  boost: number;
  fuzzyDistance: number;
  /** Override min search length; falls back to field then global default. */
  minLength?: number;
  required: boolean;
  prohibited: boolean;
}

export interface BuilderFieldConfig {
  id: string;
  field: string;
  matchers: FieldMatcher[];
  /** Optional min length for all matchers on this field unless overridden per matcher. */
  minLength?: number;
}

export interface EdismaxSettings {
  mm: string;
  min: string;
  tie: string;
  qfOverride: string;
}

export interface FilterQueryConfig {
  field: string;
  /** "true" | "false" for booleans; user text for others */
  value: string;
}

export interface BoostQueryConfig {
  field: string;
  mode: MatchMode;
  value: string;
  boost: number;
}

export const DEFAULT_BOOST_QUERY_BOOST = 10;

export interface BuilderState {
  searchText: string;
  fields: BuilderFieldConfig[];
  combineWith: ClauseOperator;
  edismax: EdismaxSettings;
  filterQuery: FilterQueryConfig | null;
  boostQuery: BoostQueryConfig | null;
}

export interface ClassicQueryState {
  q: string;
  edismax: EdismaxSettings;
  qf: string;
}

export interface SearchPlan {
  q: string;
  extra: Record<string, string>;
  summary: string;
}

export const DEFAULT_EDISMAX: EdismaxSettings = {
  mm: "",
  min: "",
  tie: "",
  qfOverride: "",
};

export const DEFAULT_BUILDER_STATE: BuilderState = {
  searchText: "",
  fields: [],
  combineWith: "OR",
  edismax: { ...DEFAULT_EDISMAX },
  filterQuery: null,
  boostQuery: null,
};

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMatcher(
  mode: MatchMode = "term",
  overrides?: Partial<Omit<FieldMatcher, "id" | "mode">>
): FieldMatcher {
  return {
    id: newId("m"),
    mode,
    boost: DEFAULT_MATCHER_BOOST,
    fuzzyDistance: DEFAULT_FUZZY_DISTANCE,
    required: false,
    prohibited: false,
    ...overrides,
  };
}

export function createFieldConfig(field: string): BuilderFieldConfig {
  return {
    id: newId("f"),
    field,
    matchers: [createMatcher("term")],
  };
}

/** @deprecated */
export type BuilderClause = BuilderFieldConfig;
/** @deprecated */
export const createClause = createFieldConfig;
