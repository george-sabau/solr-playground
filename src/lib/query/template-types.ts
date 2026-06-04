import type {
  BoostQueryConfig,
  BuilderState,
  FieldMatcher,
  FilterQueryConfig,
  QueryParserMode,
} from "@/lib/query/types";
import {
  createBoostQuery,
  createFieldConfig,
  createFilterQuery,
  createMatcher,
  DEFAULT_EDISMAX,
} from "@/lib/query/types";

export interface QueryTemplatePayload {
  version: 1;
  parser: QueryParserMode;
  builder: BuilderState;
  sourceUrl?: string;
}

type LegacyBuilderPayload = BuilderState & {
  filterQuery?: FilterQueryConfig | null;
  boostQuery?: BoostQueryConfig | null;
};

function stripFilterBoostIds(
  items: FilterQueryConfig[] | BoostQueryConfig[]
): FilterQueryConfig[] | BoostQueryConfig[] {
  return items.map((item) => {
    const { id, ...rest } = item;
    void id;
    return { ...rest, id: "" } as FilterQueryConfig & BoostQueryConfig;
  });
}

function normalizeFilterQueries(raw: LegacyBuilderPayload): FilterQueryConfig[] {
  if (Array.isArray(raw.filterQueries)) {
    return raw.filterQueries.map((f) => ({
      ...f,
      id: f.id || "",
    }));
  }
  const legacy = raw.filterQuery;
  if (legacy && typeof legacy === "object" && legacy.field) {
    return [{ ...legacy, id: legacy.id ?? "" }];
  }
  return [];
}

function normalizeBoostQueries(raw: LegacyBuilderPayload): BoostQueryConfig[] {
  if (Array.isArray(raw.boostQueries)) {
    return raw.boostQueries.map((b) => ({
      ...b,
      id: b.id || "",
    }));
  }
  const legacy = raw.boostQuery;
  if (legacy && typeof legacy === "object" && legacy.field) {
    return [{ ...legacy, id: legacy.id ?? "" }];
  }
  return [];
}

/** Logical builder config without ephemeral row ids (for persistence). */
export function stripBuilderStateIds(state: BuilderState): BuilderState {
  return {
    searchText: state.searchText,
    combineWith: state.combineWith,
    edismax: { ...state.edismax },
    filterQueries: stripFilterBoostIds(
      state.filterQueries
    ) as FilterQueryConfig[],
    boostQueries: stripFilterBoostIds(state.boostQueries) as BoostQueryConfig[],
    fields: state.fields.map((f) => ({
      id: "",
      field: f.field,
      minLength: f.minLength,
      matchers: f.matchers.map((m) => {
        const { id, ...rest } = m;
        void id;
        return { ...rest, id: "" } as FieldMatcher;
      }),
    })),
  };
}

export function cloneBuilderStateForApply(state: BuilderState): BuilderState {
  return {
    searchText: state.searchText,
    combineWith: state.combineWith,
    edismax: { ...state.edismax },
    filterQueries: state.filterQueries.map((f) => {
      const { id, ...rest } = f;
      void id;
      return createFilterQuery(rest);
    }),
    boostQueries: state.boostQueries.map((b) => {
      const { id, ...rest } = b;
      void id;
      return createBoostQuery(rest);
    }),
    fields: state.fields.map((f) => {
      const fieldName = f.field;
      const minLength = f.minLength;
      const config = createFieldConfig(fieldName);
      if (minLength !== undefined) {
        config.minLength = minLength;
      }
      config.matchers = f.matchers.map((m) => {
        const { id, ...rest } = m;
        void id;
        return createMatcher(rest.mode, rest);
      });
      return config;
    }),
  };
}

export function buildTemplatePayload(
  parser: QueryParserMode,
  builder: BuilderState,
  sourceUrl?: string
): QueryTemplatePayload {
  return {
    version: 1,
    parser,
    builder: stripBuilderStateIds(builder),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}

export function serializeTemplatePayload(payload: QueryTemplatePayload): string {
  return JSON.stringify(payload);
}

export function deserializeTemplatePayload(json: string): QueryTemplatePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("Invalid template payload JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid template payload.");
  }
  const p = parsed as QueryTemplatePayload;
  if (p.version !== 1) {
    throw new Error(`Unsupported template version: ${String((p as { version?: unknown }).version)}`);
  }
  if (!p.parser || !p.builder) {
    throw new Error("Template payload is missing parser or builder.");
  }
  const raw = p.builder as LegacyBuilderPayload;
  return {
    version: 1,
    parser: p.parser,
    builder: {
      searchText: raw.searchText ?? "",
      combineWith: raw.combineWith ?? "OR",
      edismax: { ...DEFAULT_EDISMAX, ...raw.edismax },
      fields: Array.isArray(raw.fields) ? raw.fields : [],
      filterQueries: normalizeFilterQueries(raw),
      boostQueries: normalizeBoostQueries(raw),
    },
    sourceUrl: p.sourceUrl,
  };
}
