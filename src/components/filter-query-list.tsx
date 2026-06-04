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
import {
  filterValueOptionsForField,
  isBooleanField,
} from "@/lib/query/field-value";
import type { SchemaSnapshot } from "@/lib/schema/context";
import type { BuilderState, FilterQueryConfig } from "@/lib/query/types";
import { createFilterQuery } from "@/lib/query/types";

export function FilterQueryList({
  state,
  onChange,
  fieldNames,
  schema,
}: {
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  fieldNames: string[];
  schema: SchemaSnapshot | null;
}) {
  const items = state.filterQueries;
  const count = items.length;

  const updateItem = (id: string, next: FilterQueryConfig) => {
    onChange({
      ...state,
      filterQueries: state.filterQueries.map((f) =>
        f.id === id ? next : f
      ),
    });
  };

  const removeItem = (id: string) => {
    onChange({
      ...state,
      filterQueries: state.filterQueries.filter((f) => f.id !== id),
    });
  };

  return (
    <details
      className="group rounded-md border border-border/60 bg-background/60"
      open={count > 0}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-medium [&::-webkit-details-marker]:hidden">
        <span>
          Filter queries (fq)
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
              filterQueries: [
                ...state.filterQueries,
                createFilterQuery({ field: fieldNames[0] ?? "", value: "" }),
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
            No filters — results are not restricted by field.
          </p>
        ) : (
          items.map((item) => {
            const bool = isBooleanField(schema, item.field);
            const valueOptions = filterValueOptionsForField(schema, item.field);
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-end gap-2 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5"
              >
                <div className="grid min-w-[7rem] flex-1 gap-0.5">
                  <Label className="text-[9px]">Field</Label>
                  <Select
                    value={item.field}
                    onValueChange={(field) => {
                      if (!field) return;
                      updateItem(item.id, {
                        ...item,
                        field,
                        value: isBooleanField(schema, field)
                          ? "true"
                          : item.value,
                      });
                    }}
                  >
                    <SelectTrigger className="h-7 text-[11px]">
                      <SelectValue placeholder="Field" />
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
                <div className="grid min-w-[6rem] flex-1 gap-0.5">
                  <Label className="text-[9px]">Value</Label>
                  {bool && valueOptions ? (
                    <Select
                      value={item.value || "true"}
                      disabled={!item.field}
                      onValueChange={(value) => {
                        if (!value) return;
                        updateItem(item.id, { ...item, value });
                      }}
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {valueOptions.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={item.value}
                      disabled={!item.field}
                      onChange={(e) =>
                        updateItem(item.id, {
                          ...item,
                          value: e.target.value,
                        })
                      }
                      className="h-7 text-[11px]"
                      spellCheck={false}
                    />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove filter"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </details>
  );
}
