import type {
  BuilderState,
  FieldMatcher,
  QueryParserMode,
} from "@/lib/query/types";
import {
  createFieldConfig,
  createMatcher,
  DEFAULT_EDISMAX,
} from "@/lib/query/types";

export interface QueryTemplatePayload {
  version: 1;
  parser: QueryParserMode;
  builder: BuilderState;
  sourceUrl?: string;
}

/** Logical builder config without ephemeral row ids (for persistence). */
export function stripBuilderStateIds(state: BuilderState): BuilderState {
  return {
    searchText: state.searchText,
    combineWith: state.combineWith,
    edismax: { ...state.edismax },
    filterQuery: state.filterQuery ? { ...state.filterQuery } : null,
    boostQuery: state.boostQuery ? { ...state.boostQuery } : null,
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
    filterQuery: state.filterQuery ? { ...state.filterQuery } : null,
    boostQuery: state.boostQuery ? { ...state.boostQuery } : null,
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
  return {
    version: 1,
    parser: p.parser,
    builder: {
      searchText: p.builder.searchText ?? "",
      combineWith: p.builder.combineWith ?? "OR",
      edismax: { ...DEFAULT_EDISMAX, ...p.builder.edismax },
      fields: Array.isArray(p.builder.fields) ? p.builder.fields : [],
      filterQuery: p.builder.filterQuery ?? null,
      boostQuery: p.builder.boostQuery ?? null,
    },
    sourceUrl: p.sourceUrl,
  };
}
