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

/** Selected field with optional per-field overrides (shared search text). */
export interface BuilderFieldConfig {
  id: string;
  field: string;
  /** When set, overrides global match mode for this field only. */
  mode?: MatchMode;
  boost: number;
  fuzzyDistance: number;
  required: boolean;
  prohibited: boolean;
}

export interface EdismaxSettings {
  mm: string;
  min: string;
  tie: string;
  qfOverride: string;
}

export interface BuilderState {
  /** User search prompt — applied to every selected field. */
  searchText: string;
  globalMode: MatchMode;
  globalFuzzyDistance: number;
  fields: BuilderFieldConfig[];
  combineWith: ClauseOperator;
  edismax: EdismaxSettings;
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
  globalMode: "term",
  globalFuzzyDistance: 1,
  fields: [],
  combineWith: "OR",
  edismax: { ...DEFAULT_EDISMAX },
};

export function createFieldConfig(field: string): BuilderFieldConfig {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    field,
    boost: 1,
    fuzzyDistance: 1,
    required: false,
    prohibited: false,
  };
}

/** @deprecated use BuilderFieldConfig */
export type BuilderClause = BuilderFieldConfig;

/** @deprecated use createFieldConfig */
export const createClause = createFieldConfig;
