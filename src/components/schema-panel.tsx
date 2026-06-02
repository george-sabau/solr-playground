"use client";

import { useMemo } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSchema } from "@/lib/schema/context";
import { cn } from "@/lib/utils";
import { deriveLocale } from "@/lib/schema/locale";
import { FieldTypeBadge } from "@/components/field-type-popover";
import type { SchemaField } from "@/types/solr";

function FlagPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={
        on
          ? "rounded bg-foreground/10 px-1 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground"
          : "rounded border border-dashed border-border px-1 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70"
      }
    >
      {label}
    </span>
  );
}

function LocaleChip({ locale }: { locale: string | null }) {
  if (!locale) {
    return (
      <span className="rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-foreground">
      {locale}
    </span>
  );
}

function FieldsTable({ fields }: { fields: SchemaField[] }) {
  if (fields.length === 0) {
    return (
      <div className="text-xs italic text-muted-foreground">
        No fields in this list.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 font-medium">Name</th>
            <th className="px-2 py-1.5 font-medium">Type</th>
            <th className="px-2 py-1.5 font-medium">Locale</th>
            <th className="px-2 py-1.5 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr
              key={f.name}
              className="border-t border-border align-top hover:bg-muted/20"
            >
              <td className="px-2 py-1.5 font-mono text-xs">{f.name}</td>
              <td className="px-2 py-1.5">
                <FieldTypeBadge typeName={f.type} fieldName={f.name} />
              </td>
              <td className="px-2 py-1.5">
                <LocaleChip locale={deriveLocale(f.type)} />
              </td>
              <td className="px-2 py-1.5">
                <div className="flex flex-wrap gap-0.5">
                  <FlagPill on={!!f.indexed} label="idx" />
                  <FlagPill on={!!f.stored} label="stored" />
                  <FlagPill on={!!f.multiValued} label="multi" />
                  <FlagPill on={!!f.docValues} label="dv" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DynamicRulesList({ count }: { count: number }) {
  const { schema } = useSchema();
  const rules = schema?.dynamicFields ?? [];
  if (rules.length === 0) {
    return (
      <div className="text-xs italic text-muted-foreground">
        No dynamic field rules defined.
      </div>
    );
  }
  const sorted = [...rules].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <details className="group rounded-md border border-border bg-muted/15">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/30">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-[var(--solr-accent)]" />
        <span>Show dynamic field rules</span>
        <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
          {count}
        </span>
      </summary>
      <div className="border-t border-border px-2 pb-2 pt-1">
        <div className="grid max-h-[min(50vh,28rem)] gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((r) => (
            <details
              key={r.name}
              className="group/dynrule rounded-md border border-border bg-muted/20 px-2 py-1.5 text-sm open:bg-muted/40"
            >
              <summary className="flex cursor-pointer list-none items-center gap-1.5">
                <ChevronRight className="size-3 text-muted-foreground transition-transform group-open/dynrule:rotate-90 group-open/dynrule:text-[var(--solr-accent)]" />
                <span className="font-mono text-xs">{r.name}</span>
                <span className="ml-auto">
                  <FieldTypeBadge typeName={r.type} />
                </span>
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1 pl-4 text-[10px] text-muted-foreground">
                <FlagPill on={!!r.indexed} label="idx" />
                <FlagPill on={!!r.stored} label="stored" />
                <FlagPill on={!!r.multiValued} label="multi" />
                <FlagPill on={!!r.docValues} label="dv" />
                <LocaleChip locale={deriveLocale(r.type)} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}

function CopyFieldsList({ count }: { count: number }) {
  const { schema } = useSchema();
  const cf = schema?.copyFields ?? [];
  if (cf.length === 0) {
    return (
      <div className="text-xs italic text-muted-foreground">
        No copyField rules defined.
      </div>
    );
  }
  return (
    <details className="group rounded-md border border-border bg-muted/15">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/30">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-[var(--solr-accent)]" />
        <span>Show copyField rules</span>
        <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
          {count}
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">Source</th>
              <th className="px-2 py-1.5 font-medium">Destination</th>
              <th className="px-2 py-1.5 font-medium">Max chars</th>
            </tr>
          </thead>
          <tbody>
            {cf.map((c, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/20">
                <td className="px-2 py-1 font-mono text-xs">{c.source}</td>
                <td className="px-2 py-1 font-mono text-xs">{c.dest}</td>
                <td className="px-2 py-1 font-mono text-xs text-muted-foreground">
                  {c.maxChars ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function SchemaPanel() {
  const { core, loading, error, schema, refresh } = useSchema();

  const isInternalFieldName = (n: string) =>
    n.startsWith("_") && n.endsWith("_");

  const { userFields, systemFields } = useMemo(() => {
    if (!schema) return { userFields: [] as SchemaField[], systemFields: [] as SchemaField[] };
    const user = schema.fields.filter((f) => !isInternalFieldName(f.name));
    const sys = schema.fields.filter((f) => isInternalFieldName(f.name));
    return { userFields: user, systemFields: sys };
  }, [schema]);

  if (!core) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Schema</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a core to inspect its schema.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            Schema{" "}
            <span className="ml-1 font-mono text-xs text-muted-foreground">
              {core}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Static fields, dynamic rules, copyField wiring, and field-type
            details.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className={cn(
            "ml-auto border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)] shadow-sm",
            "hover:bg-[var(--solr-accent-hover)]",
            "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/35"
          )}
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Reload
        </Button>
      </header>
      <div className="space-y-6 px-6 py-5">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Fields{" "}
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                {userFields.length}
              </span>
            </h3>
          </div>
          <FieldsTable fields={userFields} />
          {systemFields.length > 0 && (
            <details className="group mt-2 rounded-md border border-border bg-muted/15">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/30">
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-[var(--solr-accent)]" />
                <span>Internal / system fields</span>
                <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
                  {systemFields.length}
                </span>
              </summary>
              <div className="border-t border-border p-2">
                <FieldsTable fields={systemFields} />
              </div>
            </details>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Dynamic field rules</h3>
          <DynamicRulesList count={schema?.dynamicFields.length ?? 0} />
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">CopyFields</h3>
          <CopyFieldsList count={schema?.copyFields.length ?? 0} />
        </section>
      </div>
    </section>
  );
}
