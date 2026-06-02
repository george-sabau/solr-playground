"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  compileBuilderSearch,
  compileClausesToQ,
  describeClause,
  matchModeLabel,
} from "@/lib/query/compile";
import { getSearchableFields } from "@/lib/query/fields";
import type {
  BuilderClause,
  BuilderState,
  MatchMode,
  QueryParserMode,
} from "@/lib/query/types";
import { createClause } from "@/lib/query/types";
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

function ClauseEditor({
  clause,
  onChange,
  onRemove,
}: {
  clause: BuilderClause;
  onChange: (next: BuilderClause) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-[var(--solr-accent-muted)]">
          {clause.field}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${clause.field}`}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1 sm:col-span-2">
          <Label className="text-[10px]">Value</Label>
          <Input
            value={clause.value}
            onChange={(e) => onChange({ ...clause, value: e.target.value })}
            placeholder="search text…"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px]">Match</Label>
          <Select
            value={clause.mode}
            onValueChange={(v) =>
              onChange({ ...clause, mode: v as MatchMode })
            }
          >
            <SelectTrigger className="h-8 text-xs">
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
          <Label className="text-[10px]">Boost ^</Label>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={clause.boost}
            onChange={(e) =>
              onChange({
                ...clause,
                boost: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="h-8 font-mono text-xs"
          />
        </div>
        {clause.mode === "fuzzy" && (
          <div className="grid gap-1">
            <Label className="text-[10px]">Fuzzy ~</Label>
            <Input
              type="number"
              min={0}
              max={2}
              step={1}
              value={clause.fuzzyDistance}
              onChange={(e) =>
                onChange({
                  ...clause,
                  fuzzyDistance: Math.max(
                    0,
                    Math.min(2, Number(e.target.value) || 0)
                  ),
                })
              }
              className="h-8 font-mono text-xs"
            />
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={clause.required}
            onChange={(e) =>
              onChange({
                ...clause,
                required: e.target.checked,
                prohibited: e.target.checked ? false : clause.prohibited,
              })
            }
            className="size-3.5 rounded border-border"
          />
          Required (+)
        </label>
        <label className="inline-flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={clause.prohibited}
            onChange={(e) =>
              onChange({
                ...clause,
                prohibited: e.target.checked,
                required: e.target.checked ? false : clause.required,
              })
            }
            className="size-3.5 rounded border-border"
          />
          Prohibited (−)
        </label>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {describeClause(clause)}
      </p>
    </div>
  );
}

function AddFieldPopover({
  field,
  onAdd,
}: {
  field: string;
  onAdd: (clause: BuilderClause) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => createClause(field));

  const reset = () => setDraft(createClause(field));

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) reset();
  };

  const handleAdd = () => {
    onAdd({ ...draft, field });
    setOpen(false);
    reset();
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "rounded-md border border-border bg-muted/30 px-2 py-1 font-mono text-[11px]",
          "transition-colors hover:border-[var(--solr-accent)]/50 hover:bg-[var(--solr-accent)]/10"
        )}
      >
        {field}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader>
          <PopoverTitle className="font-mono text-sm">{field}</PopoverTitle>
        </PopoverHeader>
        <div className="grid gap-2 pt-1">
          <ClauseEditor
            clause={draft}
            onChange={setDraft}
            onRemove={() => setOpen(false)}
          />
          <Button type="button" size="sm" className={accentButtonClass} onClick={handleAdd}>
            <Plus className="size-3.5" />
            Add to query
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function QueryBuilderPanel({
  core,
  baseUrl,
  parser,
  onParserChange,
  state,
  onChange,
  onRun,
  loading,
}: {
  core: string;
  baseUrl: string;
  parser: QueryParserMode;
  onParserChange: (p: QueryParserMode) => void;
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  onRun: () => void;
  loading: boolean;
}) {
  const schema = useSchema();
  const fields = useMemo(
    () => getSearchableFields(schema.schema),
    [schema.schema]
  );

  const plan = compileBuilderSearch(state, parser);
  const compiledQ = compileClausesToQ(state.clauses, state.combineWith);
  const showEdismax = parser === "edismax" || parser === "dismax";

  const updateClause = (id: string, next: BuilderClause) => {
    onChange({
      ...state,
      clauses: state.clauses.map((c) => (c.id === id ? next : c)),
    });
  };

  const removeClause = (id: string) => {
    onChange({
      ...state,
      clauses: state.clauses.filter((c) => c.id !== id),
    });
  };

  const addClause = (clause: BuilderClause) => {
    onChange({ ...state, clauses: [...state.clauses, clause] });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,160px)_1fr]">
        <ParserModeSelect value={parser} onChange={onParserChange} />
        <div className="grid gap-1.5">
          <Label className="text-xs">Combine clauses</Label>
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
              <SelectItem value="AND">AND (all must match)</SelectItem>
              <SelectItem value="OR">OR (any may match)</SelectItem>
            </SelectContent>
          </Select>
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
          qfPlaceholder="Auto from fields with boost, or override e.g. title^2 body"
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Fields — click to add</Label>
          {schema.loading && (
            <span className="text-[10px] text-muted-foreground">loading schema…</span>
          )}
        </div>
        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No indexed fields loaded for this core.
          </p>
        ) : (
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-dashed border-border p-2">
            {fields.map((f) => (
              <AddFieldPopover
                key={f.name}
                field={f.name}
                onAdd={addClause}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Builder query</Label>
        {state.clauses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Click a field above to add a clause, or run{" "}
            <code className="font-mono">*:*</code> with no clauses.
          </div>
        ) : (
          <div className="space-y-2">
            {state.clauses.map((c) => (
              <ClauseEditor
                key={c.id}
                clause={c}
                onChange={(next) => updateClause(c.id, next)}
                onRemove={() => removeClause(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/10 p-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Raw syntax (compiled q)
          </p>
          <pre className="max-h-24 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
            {compiledQ}
          </pre>
        </div>
        <div className="rounded-lg border border-[var(--solr-accent)]/25 bg-[var(--solr-accent)]/5 p-3">
          <p className="mb-1.5 text-xs font-medium text-[var(--solr-accent-muted)]">
            Builder summary
          </p>
          <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-foreground">
            {state.clauses.length === 0 ? (
              <li className="text-muted-foreground">No clauses yet</li>
            ) : (
              state.clauses.map((c) => (
                <li key={c.id} className="flex gap-1.5">
                  <span className="shrink-0 text-muted-foreground">•</span>
                  <span>{describeClause(c)}</span>
                </li>
              ))
            )}
            {state.clauses.length > 1 && (
              <li className="pt-1 text-muted-foreground">
                Combined with {state.combineWith}
              </li>
            )}
          </ul>
        </div>
      </div>

      <QueryRequestPreview
        baseUrl={baseUrl}
        core={core}
        q={plan.q}
        extra={plan.extra}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {state.clauses.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange({ ...state, clauses: [] })}
          >
            <X className="size-3.5" />
            Clear builder
          </Button>
        )}
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
