"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { matchModeLabel } from "@/lib/query/compile";
import type {
  BoostQueryConfig,
  BuilderState,
  MatchMode,
} from "@/lib/query/types";
import {
  createBoostQuery,
  DEFAULT_BOOST_QUERY_BOOST,
} from "@/lib/query/types";

const MATCH_MODES: MatchMode[] = [
  "term",
  "phrase",
  "exact",
  "wildcard",
  "prefix",
  "fuzzy",
];

export function BoostQueryList({
  state,
  onChange,
  fieldNames,
}: {
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  fieldNames: string[];
}) {
  const items = state.boostQueries;
  const count = items.length;

  const updateItem = (id: string, next: BoostQueryConfig) => {
    onChange({
      ...state,
      boostQueries: state.boostQueries.map((b) =>
        b.id === id ? next : b
      ),
    });
  };

  const removeItem = (id: string) => {
    onChange({
      ...state,
      boostQueries: state.boostQueries.filter((b) => b.id !== id),
    });
  };

  return (
    <details
      className="group rounded-md border border-border/60 bg-background/60"
      open={count > 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-medium [&::-webkit-details-marker]:hidden">
        <span>
          Boost queries (bq)
          {count > 0 ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({count})
            </span>
          ) : null}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          disabled={fieldNames.length === 0}
          onClick={(e) => {
            e.preventDefault();
            onChange({
              ...state,
              boostQueries: [
                ...state.boostQueries,
                createBoostQuery({
                  field: fieldNames[0] ?? "",
                  mode: "term",
                  value: "",
                  boost: DEFAULT_BOOST_QUERY_BOOST,
                }),
              ],
            });
          }}
        >
          <Plus className="size-3" />
          Add
        </Button>
      </summary>
      <div className="space-y-1.5 border-t border-border/50 px-2.5 pb-2.5 pt-1.5">
        {count === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            No boosts — scores use field matchers only.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-end gap-2 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5"
            >
              <div className="grid min-w-[6rem] flex-1 gap-0.5">
                <Label className="text-[9px]">Field</Label>
                <Select
                  value={item.field}
                  onValueChange={(field) => {
                    if (!field) return;
                    updateItem(item.id, { ...item, field });
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-[6.5rem] gap-0.5">
                <Label className="text-[9px]">Match</Label>
                <Select
                  value={item.mode}
                  onValueChange={(v) => {
                    if (!v) return;
                    updateItem(item.id, { ...item, mode: v as MatchMode });
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px]">
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
              <div className="grid min-w-[5rem] flex-1 gap-0.5">
                <Label className="text-[9px]">Value</Label>
                <Input
                  value={item.value}
                  onChange={(e) =>
                    updateItem(item.id, { ...item, value: e.target.value })
                  }
                  className="h-7 text-[11px]"
                  spellCheck={false}
                />
              </div>
              <div className="grid w-14 gap-0.5">
                <Label className="text-[9px]">Boost</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={item.boost}
                  onChange={(e) =>
                    updateItem(item.id, {
                      ...item,
                      boost: Math.max(
                        1,
                        Number(e.target.value) || DEFAULT_BOOST_QUERY_BOOST
                      ),
                    })
                  }
                  className="h-7 font-mono text-[11px]"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove boost"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
