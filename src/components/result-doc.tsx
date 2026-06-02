"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useSchema } from "@/lib/schema/context";
import { FieldRow } from "@/components/field-row";
import type { SolrDoc, SolrFieldValue } from "@/types/solr";

interface FieldGroup {
  label: string;
  rule: string | null;
  names: string[];
  collapsible: boolean;
}

const SYSTEM_FIELDS = new Set([
  "_version_",
  "_root_",
  "_nest_path_",
  "_text_",
  "score",
]);

function isInternalDocField(name: string): boolean {
  return SYSTEM_FIELDS.has(name) || (name.startsWith("_") && name.endsWith("_"));
}

function formatCompactValue(v: SolrFieldValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const head = v.slice(0, 3).map((x) => String(x));
    return v.length > 3 ? `${head.join(", ")}…` : head.join(", ");
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  const s = String(v);
  return s.length > 72 ? `${s.slice(0, 69)}…` : s;
}

/** Up to `max` non-internal static field names (schema order) that have a value on `doc`. */
function pickHighlightFieldNames(
  doc: SolrDoc,
  staticOrder: string[],
  max: number
): string[] {
  const out: string[] = [];
  for (const name of staticOrder) {
    if (out.length >= max) break;
    if (name === "id" || name === "score") continue;
    if (isInternalDocField(name)) continue;
    const v = doc[name];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out.push(name);
  }
  return out;
}

function ScoreBar({
  score,
  maxScore,
  compact,
}: {
  score: number | undefined;
  maxScore: number | undefined;
  compact?: boolean;
}) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const max = maxScore && maxScore > 0 ? maxScore : score;
  const ratio = Math.min(1, Math.max(0, score / max));
  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[var(--solr-accent)]/85"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--solr-accent)]/85"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="font-mono text-[9px] tabular-nums text-[var(--solr-accent-muted)]">
        {score.toFixed(4)}
      </span>
    </div>
  );
}

function FieldGroupBlock({
  group,
  doc,
}: {
  group: FieldGroup;
  doc: SolrDoc;
}) {
  const body = (
    <div>
      {group.names.map((n) => (
        <FieldRow key={n} name={n} value={doc[n]} />
      ))}
    </div>
  );

  if (!group.collapsible) {
    return (
      <div>
        <div className="border-t border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground first:border-t-0">
          {group.label}
          {group.rule && (
            <span className="ml-1 font-mono text-[10px] normal-case text-muted-foreground/80">
              ({group.names.length})
            </span>
          )}
        </div>
        {body}
      </div>
    );
  }

  return (
    <details className="group/fg border-t border-border/60 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 bg-muted/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/35">
        <ChevronRight className="size-2.5 shrink-0 text-muted-foreground transition-transform group-open/fg:rotate-90" />
        {group.label}
        <span className="ml-auto font-mono text-[10px] font-normal normal-case">
          {group.names.length} field{group.names.length === 1 ? "" : "s"}
        </span>
      </summary>
      <div>{body}</div>
    </details>
  );
}

export function ResultDoc({
  rank,
  doc,
  maxScore,
  expanded,
  onToggle,
}: {
  rank: number;
  doc: SolrDoc;
  maxScore: number | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const schema = useSchema();
  const id = typeof doc.id === "string" ? doc.id : String(doc.id ?? "(no id)");
  const score = typeof doc.score === "number" ? doc.score : undefined;

  const staticOrder = useMemo(
    () =>
      schema.schema?.fields
        .filter((f) => !isInternalDocField(f.name))
        .map((f) => f.name) ?? [],
    [schema.schema?.fields]
  );

  const highlightNames = useMemo(
    () => pickHighlightFieldNames(doc, staticOrder, 5),
    [doc, staticOrder]
  );

  const groups = useMemo<FieldGroup[]>(() => {
    const presentNames = Object.keys(doc).filter(
      (k) => k !== "id" && k !== "score"
    );
    const internalNames = presentNames.filter(isInternalDocField);
    const restNames = presentNames.filter((n) => !internalNames.includes(n));

    const staticPresent = staticOrder.filter((n) => restNames.includes(n));
    const remaining = restNames.filter((n) => !staticPresent.includes(n));

    const dynamicGroups = new Map<string, string[]>();
    const unknown: string[] = [];
    for (const n of remaining) {
      const meta = schema.getFieldMeta(n);
      if (meta.isDynamic && meta.dynamicMatch) {
        const ruleName = meta.dynamicMatch.rule.name;
        const arr = dynamicGroups.get(ruleName) ?? [];
        arr.push(n);
        dynamicGroups.set(ruleName, arr);
      } else {
        unknown.push(n);
      }
    }

    const out: FieldGroup[] = [];
    if (staticPresent.length > 0) {
      out.push({
        label: "Static fields",
        rule: null,
        names: staticPresent,
        collapsible: false,
      });
    }
    for (const [rule, names] of [...dynamicGroups.entries()].sort(
      ([a], [b]) => a.localeCompare(b)
    )) {
      names.sort();
      out.push({
        label: `Dynamic ${rule}`,
        rule,
        names,
        collapsible: true,
      });
    }
    if (unknown.length > 0) {
      unknown.sort();
      out.push({
        label: "Other",
        rule: null,
        names: unknown,
        collapsible: true,
      });
    }
    if (internalNames.length > 0) {
      internalNames.sort();
      out.push({
        label: "Internal / system",
        rule: null,
        names: internalNames,
        collapsible: true,
      });
    }
    return out;
  }, [doc, schema, staticOrder]);

  return (
    <article className="rounded-md border border-border bg-card text-card-foreground">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 border-b border-border px-2 py-0.5 text-left hover:bg-muted/25"
        aria-expanded={expanded}
      >
        <ChevronRight
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          #{rank}
        </span>
        <span className="min-w-0 shrink truncate font-mono text-xs font-semibold">
          {id}
        </span>
        <span className="inline-flex shrink-0 items-baseline gap-0.5 font-mono tabular-nums leading-none">
          <span className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
            score
          </span>
          {typeof score === "number" && Number.isFinite(score) ? (
            <span className="text-[9px] font-semibold text-[var(--solr-accent-muted)]">
              {score.toFixed(4)}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground">—</span>
          )}
        </span>
        {!expanded && (
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            {highlightNames.map((name, i) => (
              <span key={name}>
                {i > 0 ? " · " : ""}
                <span className="text-muted-foreground/90">{name}</span>
                {": "}
                <span className="font-mono text-foreground/90">
                  {formatCompactValue(doc[name])}
                </span>
              </span>
            ))}
          </span>
        )}
        <ScoreBar score={score} maxScore={maxScore} compact={!expanded} />
      </button>
      {expanded && (
        <div>
          {groups.map((g, gi) => (
            <FieldGroupBlock key={gi} group={g} doc={doc} />
          ))}
        </div>
      )}
    </article>
  );
}
