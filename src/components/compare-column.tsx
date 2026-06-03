"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { LoadFromSourcePanel } from "@/components/load-from-source-panel";
import { QueryResultsList } from "@/components/query-results-list";
import { compileBuilderSearch } from "@/lib/query/compile";
import type {
  BuilderState,
  QueryParserMode,
  SearchPlan,
} from "@/lib/query/types";
import type { SelectResponse } from "@/types/solr";
import type { SchemaField } from "@/types/solr";

export interface CompareColumnState {
  builderState: BuilderState;
  parser: QueryParserMode;
  importUrl: string;
  importError: string | null;
  importWarnings: string[];
  sourceLabel: string | null;
  /** Set true after a successful URL or template load. */
  sourceReady: boolean;
}

export function isCompareColumnReady(column: CompareColumnState): boolean {
  return column.builderState.fields.length > 0;
}

export function CompareColumn({
  title,
  endpointId,
  core,
  column,
  onColumnChange,
  searchableFields,
  plan,
  response,
  loading,
  error,
  stats,
}: {
  title: string;
  endpointId: string;
  core: string;
  column: CompareColumnState;
  onColumnChange: Dispatch<SetStateAction<CompareColumnState>>;
  searchableFields: SchemaField[];
  plan: SearchPlan | null;
  response: SelectResponse | null;
  loading: boolean;
  error: string | null;
  stats?: { numFound: number; qTime: number | null; wallTimeMs: number };
}) {
  const docs = useMemo(() => response?.response.docs ?? [], [response]);
  const maxScore =
    response?.response.maxScore ??
    (docs.length > 0
      ? docs.reduce(
          (m, d) =>
            typeof d.score === "number" ? Math.max(m, d.score) : m,
          0
        )
      : undefined);

  const previewPlan = useMemo(
    () =>
      plan ??
      compileBuilderSearch(column.builderState, column.parser),
    [plan, column.builderState, column.parser]
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border/80 bg-muted/10 p-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {isCompareColumnReady(column) ? (
          <p className="mt-0.5 truncate text-[11px] text-[var(--solr-accent-muted)]">
            Loaded: {column.sourceLabel ?? "query setup"}
          </p>
        ) : (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Load a URL or template below
          </p>
        )}
      </div>

      {searchableFields.length === 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Waiting for schema fields — load will work once the core schema is ready.
        </p>
      )}

      <LoadFromSourcePanel
        endpointId={endpointId}
        core={core}
        importUrl={column.importUrl}
        onImportUrlChange={(url) =>
          onColumnChange((prev) => ({
            ...prev,
            importUrl: url,
            sourceReady: false,
            sourceLabel: null,
          }))
        }
        importError={column.importError}
        onImportErrorChange={(err) =>
          onColumnChange((prev) => ({ ...prev, importError: err }))
        }
        importWarnings={column.importWarnings}
        onImportWarningsChange={(w) =>
          onColumnChange((prev) => ({ ...prev, importWarnings: w }))
        }
        onChange={(state) =>
          onColumnChange((prev) => ({
            ...prev,
            builderState: state,
            sourceReady: state.fields.length > 0,
          }))
        }
        onParserChange={(parser) =>
          onColumnChange((prev) => ({ ...prev, parser }))
        }
        searchableFields={searchableFields}
        onLoaded={(result) =>
          onColumnChange((prev) => ({
            ...prev,
            builderState: result.state,
            parser: result.parser,
            sourceLabel: result.label,
            sourceReady: result.state.fields.length > 0,
            importWarnings: result.warnings,
            importError: null,
          }))
        }
      />

      <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-[11px]">
        <p className="text-muted-foreground">Query preview</p>
        <code className="mt-1 block break-all font-mono text-foreground">
          {previewPlan.summary}
        </code>
        <p className="mt-1 text-muted-foreground">
          parser: {previewPlan.extra.defType ?? "lucene"} ·{" "}
          {column.builderState.fields.length} field
          {column.builderState.fields.length === 1 ? "" : "s"}
        </p>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            <span className="text-foreground">{stats.numFound}</span> hits
          </span>
          {stats.qTime != null && (
            <span>
              Solr <span className="text-foreground">{stats.qTime}ms</span>
            </span>
          )}
          <span>
            wall{" "}
            <span className="text-foreground">
              {stats.wallTimeMs.toFixed(0)}ms
            </span>
          </span>
        </div>
      )}

      <QueryResultsList
        docs={docs}
        start={0}
        maxScore={maxScore}
        loading={loading}
        error={error}
        searched={!!response || !!error}
      />
    </div>
  );
}
