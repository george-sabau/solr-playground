"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  compileBuilderSearch,
  describeBoostQuery,
  describeFieldConfig,
  describeFilterQuery,
  formatCompiledQueryDisplay,
  isMatcherActive,
  matchModeLabel,
} from "@/lib/query/compile";
import { getSearchableFields } from "@/lib/query/fields";
import { BoostQueryList } from "@/components/boost-query-list";
import { FilterQueryList } from "@/components/filter-query-list";
import { LoadFromSourcePanel } from "@/components/load-from-source-panel";
import { TemplateActionsSection } from "@/components/template-actions-section";
import type { LoadedTemplateRef } from "@/components/save-template-dialog";
import type {
  BuilderFieldConfig,
  BuilderState,
  FieldMatcher,
  MatchMode,
  QueryParserMode,
} from "@/lib/query/types";
import {
  createFieldConfig,
  createMatcher,
  DEFAULT_MIN_QUERY_LENGTH,
} from "@/lib/query/types";
import { useSchema } from "@/lib/schema/context";
import { QueryRequestPreview } from "@/components/query-request-preview";
import {
  EdismaxSettingsFields,
  ParserModeSelect,
} from "@/components/query-shared-fields";
import { cn } from "@/lib/utils";

const accentButtonClass = cn(
  "border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)]",
  "shadow-sm hover:bg-[var(--solr-accent-hover)]",
  "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/35"
);

const MATCH_MODES: MatchMode[] = [
  "term",
  "phrase",
  "exact",
  "wildcard",
  "prefix",
  "fuzzy",
];

function MatcherRow({
  matcher,
  field,
  searchText,
  edismaxMode,
  canRemove,
  onChange,
  onRemove,
}: {
  matcher: FieldMatcher;
  field: BuilderFieldConfig;
  searchText: string;
  edismaxMode: boolean;
  canRemove: boolean;
  onChange: (next: FieldMatcher) => void;
  onRemove: () => void;
}) {
  const active = isMatcherActive(matcher, field, searchText);

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1.5",
        !active && searchText.trim() && "opacity-60"
      )}
    >
      <div className="grid gap-1">
        <Label className="text-[10px]">Match</Label>
        <Select
          value={matcher.mode}
          onValueChange={(v) => onChange({ ...matcher, mode: v as MatchMode })}
        >
          <SelectTrigger className="h-7 w-[7.5rem] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {matchModeLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label className="text-[10px]">Boost</Label>
        <Input
          type="number"
          min={0}
          step={0.1}
          value={matcher.boost}
          onChange={(e) =>
            onChange({
              ...matcher,
              boost: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className="h-7 w-14 font-mono text-[11px]"
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-[10px]">Min length</Label>
        <Input
          type="number"
          min={0}
          max={64}
          step={1}
          placeholder={String(
            field.minLength ?? DEFAULT_MIN_QUERY_LENGTH
          )}
          value={matcher.minLength ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...matcher,
              minLength: v === "" ? undefined : Math.max(0, Number(v) || 0),
            });
          }}
          className="h-7 w-14 font-mono text-[11px]"
        />
      </div>
      {matcher.mode === "fuzzy" && (
        <div className="grid gap-1">
          <Label className="text-[10px]">Fuzzy distance</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={1}
            value={matcher.fuzzyDistance}
            onChange={(e) =>
              onChange({
                ...matcher,
                fuzzyDistance: Math.max(
                  0,
                  Math.min(2, Number(e.target.value) || 0)
                ),
              })
            }
            className="h-7 w-14 font-mono text-[11px]"
          />
        </div>
      )}
      {!edismaxMode && (
        <div className="flex items-center gap-2 pb-0.5">
          <label className="inline-flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={matcher.required}
              onChange={(e) =>
                onChange({
                  ...matcher,
                  required: e.target.checked,
                  prohibited: e.target.checked ? false : matcher.prohibited,
                })
              }
              className="size-3 rounded border-border"
            />
            Required (+)
          </label>
          <label className="inline-flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={matcher.prohibited}
              onChange={(e) =>
                onChange({
                  ...matcher,
                  prohibited: e.target.checked,
                  required: e.target.checked ? false : matcher.required,
                })
              }
              className="size-3 rounded border-border"
            />
            Prohibited (−)
          </label>
        </div>
      )}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto size-6 text-muted-foreground hover:text-destructive"
          aria-label="Remove matcher"
          onClick={onRemove}
        >
          <Trash2 className="size-3" />
        </Button>
      )}
    </div>
  );
}

function FieldMatchersCard({
  field,
  searchText,
  edismaxMode,
  onChange,
  onRemoveField,
}: {
  field: BuilderFieldConfig;
  searchText: string;
  edismaxMode: boolean;
  onChange: (next: BuilderFieldConfig) => void;
  onRemoveField: () => void;
}) {
  const updateMatcher = (id: string, next: FieldMatcher) => {
    onChange({
      ...field,
      matchers: field.matchers.map((m) => (m.id === id ? next : m)),
    });
  };

  const removeMatcher = (id: string) => {
    if (field.matchers.length <= 1) return;
    onChange({
      ...field,
      matchers: field.matchers.filter((m) => m.id !== id),
    });
  };

  const addMatcher = () => {
    onChange({
      ...field,
      matchers: [...field.matchers, createMatcher()],
    });
  };

  const matcherModes = field.matchers
    .map((m) => matchModeLabel(m.mode))
    .join(" · ");
  const collapsedSummary =
    field.matchers.length === 1
      ? matcherModes
      : `${field.matchers.length} matchers · ${matcherModes}`;

  return (
    <li>
      <details className="group rounded-lg border border-border/80 bg-muted/10">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 hover:bg-muted/20 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-[var(--solr-accent)]" />
          <span className="shrink-0 font-mono text-xs font-medium">
            {field.field}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            {collapsedSummary}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${field.field}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveField();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </summary>
        <div className="space-y-1.5 border-t border-border/80 px-2.5 pb-2.5 pt-2">
          {field.matchers.map((m) => (
            <MatcherRow
              key={m.id}
              matcher={m}
              field={field}
              searchText={searchText}
              edismaxMode={edismaxMode}
              canRemove={field.matchers.length > 1}
              onChange={(next) => updateMatcher(m.id, next)}
              onRemove={() => removeMatcher(m.id)}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-muted-foreground"
            onClick={addMatcher}
          >
            <Plus className="size-3" />
            Add matcher
          </Button>
          {field.matchers.length > 1 && (
            <p className="text-[10px] text-muted-foreground">
              Matchers on this field are combined with OR.
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

export function QueryBuilderPanel({
  endpointId,
  core,
  baseUrl,
  parser,
  onParserChange,
  state,
  onChange,
  importUrl,
  onImportUrlChange,
  importError,
  onImportErrorChange,
  importWarnings,
  onImportWarningsChange,
  onRun,
  loading,
}: {
  endpointId: string;
  core: string;
  baseUrl: string;
  parser: QueryParserMode;
  onParserChange: (p: QueryParserMode) => void;
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  importError: string | null;
  onImportErrorChange: (error: string | null) => void;
  importWarnings: string[];
  onImportWarningsChange: (warnings: string[]) => void;
  onRun: () => void;
  loading: boolean;
}) {
  const schema = useSchema();
  const [templateListTick, setTemplateListTick] = useState(0);
  const scopeKey = `${endpointId}:${core}`;
  const [loadedTemplate, setLoadedTemplate] = useState<LoadedTemplateRef | null>(
    null
  );
  const [loadedScopeKey, setLoadedScopeKey] = useState(scopeKey);
  const activeLoadedTemplate =
    loadedScopeKey === scopeKey ? loadedTemplate : null;

  const handleTemplateLoaded = (ref: LoadedTemplateRef) => {
    setLoadedTemplate(ref);
    setLoadedScopeKey(scopeKey);
  };

  const handleTemplateCleared = () => {
    setLoadedTemplate(null);
    setLoadedScopeKey(scopeKey);
  };
  const fields = useMemo(
    () => getSearchableFields(schema.schema),
    [schema.schema]
  );

  const selectedNames = useMemo(
    () => new Set(state.fields.map((f) => f.field)),
    [state.fields]
  );

  const fieldTypes = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const f of fields) {
      map[f.name] = f.type;
    }
    return map;
  }, [fields]);

  const plan = compileBuilderSearch(state, parser, { fieldTypes });
  const showEdismax = parser === "edismax" || parser === "dismax";
  const fieldNames = useMemo(() => fields.map((f) => f.name), [fields]);

  const toggleField = (name: string) => {
    if (selectedNames.has(name)) {
      onChange({
        ...state,
        fields: state.fields.filter((f) => f.field !== name),
      });
    } else {
      onChange({
        ...state,
        fields: [...state.fields, createFieldConfig(name)],
      });
    }
  };

  const updateField = (id: string, next: BuilderFieldConfig) => {
    onChange({
      ...state,
      fields: state.fields.map((f) => (f.id === id ? next : f)),
    });
  };

  const selectAllFields = () => {
    const existing = new Set(state.fields.map((f) => f.field));
    const added = fields
      .filter((f) => !existing.has(f.name))
      .map((f) => createFieldConfig(f.name));
    onChange({ ...state, fields: [...state.fields, ...added] });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
        <ParserModeSelect value={parser} onChange={onParserChange} />
        <div className="grid gap-1.5">
          <Label htmlFor="builder-search" className="text-xs">
            Search
          </Label>
          <Input
            id="builder-search"
            value={state.searchText}
            onChange={(e) =>
              onChange({ ...state, searchText: e.target.value })
            }
            placeholder="What are you looking for?"
            spellCheck={false}
            className="text-sm focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/25"
          />
          <p className="text-[11px] text-muted-foreground">
            One prompt applied to every selected field — like a search box on a
            web shop.
          </p>
        </div>
      </div>

      <LoadFromSourcePanel
        key={templateListTick}
        endpointId={endpointId}
        core={core}
        importUrl={importUrl}
        onImportUrlChange={onImportUrlChange}
        importError={importError}
        onImportErrorChange={onImportErrorChange}
        importWarnings={importWarnings}
        onImportWarningsChange={onImportWarningsChange}
        onChange={onChange}
        onParserChange={onParserChange}
        searchableFields={fields}
        onTemplateLoaded={handleTemplateLoaded}
        onTemplateCleared={handleTemplateCleared}
      />

      <TemplateActionsSection
        endpointId={endpointId}
        core={core}
        baseUrl={baseUrl}
        parser={parser}
        builderState={state}
        fieldTypes={fieldTypes}
        loadedTemplate={activeLoadedTemplate}
        onLoadedTemplateClear={handleTemplateCleared}
        onTemplatesChanged={() => setTemplateListTick((n) => n + 1)}
      />

      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 p-3">
        <Label className="text-xs">Query options</Label>
        <div className="grid max-w-xs gap-1">
          <Label className="text-[10px]">Combine fields</Label>
          <Select
            value={state.combineWith}
            onValueChange={(v) =>
              onChange({
                ...state,
                combineWith: v as BuilderState["combineWith"],
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OR">OR (match any field)</SelectItem>
              <SelectItem value="AND">AND (match all fields)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <FilterQueryList
            state={state}
            onChange={onChange}
            fieldNames={fieldNames}
            schema={schema.schema}
          />
          <BoostQueryList
            state={state}
            onChange={onChange}
            fieldNames={fieldNames}
          />
        </div>
      </div>

      {showEdismax && (
        <EdismaxSettingsFields
          value={state.edismax}
          onChange={(edismax) => onChange({ ...state, edismax })}
          showQf
          qf={state.edismax.qfOverride}
          onQfChange={(qfOverride) =>
            onChange({
              ...state,
              edismax: { ...state.edismax, qfOverride },
            })
          }
          qfPlaceholder={
            state.fields.length > 0
              ? "Auto from selected fields — or override"
              : "Select fields below, or set qf manually"
          }
        />
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs">Search in fields</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={fields.length === 0}
              onClick={selectAllFields}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={state.fields.length === 0}
              onClick={() => onChange({ ...state, fields: [] })}
            >
              Clear fields
            </Button>
          </div>
        </div>
        {schema.loading && (
          <p className="text-[10px] text-muted-foreground">loading schema…</p>
        )}
        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No indexed fields loaded for this core.
          </p>
        ) : (
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-dashed border-border p-2">
            {fields.map((f) => {
              const selected = selectedNames.has(f.name);
              return (
                <button
                  key={f.name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleField(f.name)}
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                    selected
                      ? "border-[var(--solr-accent)] bg-[var(--solr-accent)]/15 text-[var(--solr-accent-muted)]"
                      : "border-border bg-muted/30 hover:border-[var(--solr-accent)]/40 hover:bg-muted/50"
                  )}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        )}
        {state.fields.length > 0 && (
          <ul className="space-y-2">
            {state.fields.map((f) => (
              <FieldMatchersCard
                key={f.id}
                field={f}
                searchText={state.searchText}
                edismaxMode={showEdismax}
                onChange={(next) => updateField(f.id, next)}
                onRemoveField={() => toggleField(f.field)}
              />
            ))}
          </ul>
        )}
        {state.fields.length > 0 && showEdismax && (
          <p className="text-[11px] text-muted-foreground">
            Edismax compiles matchers into{" "}
            <code className="font-mono">q</code> and uses selected fields in{" "}
            <code className="font-mono">qf</code> (max boost per field).
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Compiled query
          </p>
          <pre className="max-h-28 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
            {formatCompiledQueryDisplay(plan)}
          </pre>
        </div>
        <div className="rounded-lg border border-[var(--solr-accent)]/25 bg-[var(--solr-accent)]/5 p-3">
          <p className="mb-1.5 text-xs font-medium text-[var(--solr-accent-muted)]">
            Builder summary
          </p>
          <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-foreground">
            <li>
              <span className="text-muted-foreground">Search: </span>
              {state.searchText.trim() ? (
                <span>“{state.searchText.trim()}”</span>
              ) : (
                <span className="text-muted-foreground">(empty → *:*)</span>
              )}
            </li>
            {state.fields.length > 0 && (
              <>
                <li>
                  <span className="text-muted-foreground">Fields: </span>
                  {state.fields.map((f) => f.field).join(", ")}
                </li>
                <li className="text-muted-foreground">
                  Combined with {state.combineWith}
                </li>
                {state.fields.map((f) => (
                  <li key={f.id} className="flex gap-1.5 pl-2">
                    <span className="shrink-0 text-muted-foreground">•</span>
                    <span>{describeFieldConfig(f, state.searchText)}</span>
                  </li>
                ))}
              </>
            )}
            {state.fields.length === 0 && (
              <li>
                <span className="text-muted-foreground">Fields: </span>
                <span className="text-muted-foreground">none selected</span>
              </li>
            )}
            <li>
              <span className="text-muted-foreground">Filters: </span>
              {state.filterQueries.length === 0 ? (
                <span className="text-muted-foreground">none</span>
              ) : (
                <ul className="mt-0.5 space-y-0.5 pl-2">
                  {state.filterQueries.map((fq) => (
                    <li key={fq.id} className="flex gap-1.5">
                      <span className="shrink-0 text-muted-foreground">•</span>
                      <span className="font-mono text-[10px]">
                        {describeFilterQuery(
                          fq,
                          fieldTypes[fq.field.trim()]
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              <span className="text-muted-foreground">Boosts: </span>
              {state.boostQueries.length === 0 ? (
                <span className="text-muted-foreground">none</span>
              ) : (
                <ul className="mt-0.5 space-y-0.5 pl-2">
                  {state.boostQueries.map((bq) => (
                    <li key={bq.id} className="flex gap-1.5">
                      <span className="shrink-0 text-muted-foreground">•</span>
                      <span className="font-mono text-[10px]">
                        {describeBoostQuery(bq)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </div>
      </div>

      <QueryRequestPreview
        baseUrl={baseUrl}
        core={core}
        q={plan.q}
        extra={plan.extra}
        fq={plan.fq}
        bq={plan.bq}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            onChange({
              ...state,
              searchText: "",
              fields: [],
            })
          }
        >
          <X className="size-3.5" />
          Clear all
        </Button>
        <Button
          type="button"
          disabled={loading}
          className={cn(accentButtonClass, "ml-auto")}
          onClick={onRun}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Play />}
          Run
        </Button>
      </div>
    </div>
  );
}
