"use client";

import type { EdismaxSettings, QueryParserMode } from "@/lib/query/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ParserModeSelect({
  value,
  onChange,
  id = "query-parser",
}: {
  value: QueryParserMode;
  onChange: (v: QueryParserMode) => void;
  id?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        Query parser
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as QueryParserMode)}>
        <SelectTrigger id={id} className="h-8 font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lucene">Classic Lucene (default)</SelectItem>
          <SelectItem value="edismax">Extended DisMax (edismax)</SelectItem>
          <SelectItem value="dismax">DisMax (dismax)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function EdismaxSettingsFields({
  value,
  onChange,
  showQf,
  qf,
  onQfChange,
  qfPlaceholder,
}: {
  value: EdismaxSettings;
  onChange: (next: EdismaxSettings) => void;
  showQf?: boolean;
  qf?: string;
  onQfChange?: (v: string) => void;
  qfPlaceholder?: string;
}) {
  const patch = (key: keyof EdismaxSettings, v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-3 rounded-lg border border-border/80 bg-muted/15 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        DisMax / Extended DisMax options
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="edismax-mm" className="text-xs">
            mm (min should match)
          </Label>
          <Input
            id="edismax-mm"
            value={value.mm}
            onChange={(e) => patch("mm", e.target.value)}
            placeholder="e.g. 100% or 2<-1 5<-2"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edismax-min" className="text-xs">
            min (min word length)
          </Label>
          <Input
            id="edismax-min"
            value={value.min}
            onChange={(e) => patch("min", e.target.value)}
            placeholder="e.g. 3"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edismax-tie" className="text-xs">
            tie (tie breaker)
          </Label>
          <Input
            id="edismax-tie"
            value={value.tie}
            onChange={(e) => patch("tie", e.target.value)}
            placeholder="e.g. 0.1"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>
      {showQf && onQfChange && (
        <div className="grid gap-1.5">
          <Label htmlFor="edismax-qf" className="text-xs">
            qf (query fields)
          </Label>
          <Input
            id="edismax-qf"
            value={qf ?? ""}
            onChange={(e) => onQfChange(e.target.value)}
            placeholder={qfPlaceholder ?? "title^2 body^1"}
            className="h-8 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}
