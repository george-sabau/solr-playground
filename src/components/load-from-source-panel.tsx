"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { applyBuilderImport } from "@/lib/query/apply-builder-import";
import {
  ImportBuilderError,
  importBuilderFromSolrUrl,
} from "@/lib/query/import";
import type { BuilderState, QueryParserMode } from "@/lib/query/types";
import type { SchemaField } from "@/types/solr";
import {
  fetchTemplate,
  fetchTemplates,
  type TemplateListItem,
} from "@/lib/templates-api";
import { cn } from "@/lib/utils";

type LoadSourceKind = "url" | "template";

export interface LoadFromSourceResult {
  label: string;
  parser: QueryParserMode;
  state: BuilderState;
  warnings: string[];
}

export function LoadFromSourcePanel({
  endpointId,
  core,
  importUrl,
  onImportUrlChange,
  importError,
  onImportErrorChange,
  importWarnings,
  onImportWarningsChange,
  onChange,
  onParserChange,
  searchableFields,
  onLoaded,
}: {
  endpointId: string;
  core: string;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  importError: string | null;
  onImportErrorChange: (error: string | null) => void;
  importWarnings: string[];
  onImportWarningsChange: (warnings: string[]) => void;
  onChange: (next: BuilderState) => void;
  onParserChange: (p: QueryParserMode) => void;
  searchableFields: SchemaField[];
  /** Compare columns: one atomic parent update. Play tab: omit to use onChange/onParserChange. */
  onLoaded?: (result: LoadFromSourceResult) => void;
}) {
  const [sourceKind, setSourceKind] = useState<LoadSourceKind>("template");
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loadBusy, setLoadBusy] = useState(false);

  const selectedTemplateLabel = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId)?.name,
    [templates, selectedTemplateId]
  );

  const refreshTemplates = useCallback(async () => {
    if (!endpointId || !core) {
      setTemplates([]);
      return;
    }
    setTemplatesLoading(true);
    try {
      const list = await fetchTemplates(endpointId, core);
      setTemplates(list);
      setSelectedTemplateId((prev) =>
        list.some((t) => t.id === prev) ? prev : (list[0]?.id ?? "")
      );
    } catch {
      setTemplates([]);
      setSelectedTemplateId("");
    } finally {
      setTemplatesLoading(false);
    }
  }, [endpointId, core]);

  useEffect(() => {
    if (sourceKind === "template") {
      void refreshTemplates();
    }
  }, [sourceKind, refreshTemplates]);

  const truncateLabel = (text: string, max = 56) => {
    const t = text.trim();
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  };

  const commitLoad = useCallback(
    (
      label: string,
      parser: QueryParserMode,
      rawState: BuilderState,
      importWarningsList: string[] = []
    ) => {
      onImportErrorChange(null);

      let failed = false;
      let appliedState: BuilderState | null = null;
      let mergedWarnings: string[] = [];

      applyBuilderImport({
        parser,
        state: rawState,
        warnings: importWarningsList,
        onChange: (state) => {
          appliedState = state;
        },
        onParserChange: () => {
          /* applied in commit step below */
        },
        onWarnings: (w) => {
          mergedWarnings = w;
          onImportWarningsChange(w);
        },
        onError: (msg) => {
          if (msg) {
            failed = true;
            onImportErrorChange(msg);
          }
        },
        searchableFields,
      });

      if (failed || !appliedState) {
        return false;
      }

      const result: LoadFromSourceResult = {
        label,
        parser,
        state: appliedState,
        warnings: mergedWarnings,
      };

      if (onLoaded) {
        onLoaded(result);
      } else {
        onChange(appliedState);
        onParserChange(parser);
      }

      return true;
    },
    [
      onChange,
      onParserChange,
      onImportErrorChange,
      onImportWarningsChange,
      onLoaded,
      searchableFields,
    ]
  );

  const handleUrlLoad = () => {
    if (!importUrl.trim()) {
      onImportErrorChange("Paste a Solr select URL or query string.");
      return;
    }
    try {
      const parsed = importBuilderFromSolrUrl(importUrl);
      commitLoad(
        truncateLabel(importUrl),
        parsed.parser,
        parsed.state,
        parsed.warnings
      );
    } catch (err) {
      onImportWarningsChange([]);
      onImportErrorChange(
        err instanceof ImportBuilderError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Import failed."
      );
    }
  };

  const handleTemplateLoad = async () => {
    if (!selectedTemplateId) {
      onImportErrorChange("Choose a template first.");
      return;
    }
    onImportErrorChange(null);
    onImportWarningsChange([]);
    setLoadBusy(true);
    try {
      const record = await fetchTemplate(selectedTemplateId);
      if (record.endpointId !== endpointId || record.core !== core) {
        onImportErrorChange(
          "Template does not match the current endpoint or core."
        );
        return;
      }
      commitLoad(record.name, record.parser, record.payload.builder);
    } catch (err) {
      onImportErrorChange(
        err instanceof Error ? err.message : "Failed to load template."
      );
    } finally {
      setLoadBusy(false);
    }
  };

  return (
    <details className="group rounded-lg border border-dashed border-border/80 bg-muted/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/20 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 group-open:text-[var(--solr-accent)]" />
        Load from source
      </summary>
      <div className="space-y-3 border-t border-border/80 px-3 pb-3 pt-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["template", "From query template"],
              ["url", "From Solr URL"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                sourceKind === kind
                  ? "border-[var(--solr-accent)] bg-[var(--solr-accent)]/10 text-foreground"
                  : "border-border/80 text-muted-foreground hover:bg-muted/30"
              )}
              onClick={() => {
                setSourceKind(kind);
                onImportErrorChange(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {sourceKind === "url" ? (
          <>
            <p className="text-[11px] text-muted-foreground">
              Paste a Solr select URL (or query string) to reverse-engineer field
              matchers, search text, parser, and edismax settings.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={importUrl}
                onChange={(e) => {
                  onImportUrlChange(e.target.value);
                  if (importError) onImportErrorChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUrlLoad();
                  }
                }}
                placeholder="http://localhost:8983/solr/core/select?q=..."
                spellCheck={false}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!importUrl.trim()}
                onClick={handleUrlLoad}
              >
                <Download className="size-3.5" />
                Load
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              Load a saved query setup for this endpoint and core. Fields are
              checked against the live schema before applying.
            </p>
            {templatesLoading ? (
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading templates…
              </p>
            ) : templates.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No templates for this core — save your current setup below.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="grid flex-1 gap-1">
                  <Label className="text-[10px]">Template</Label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(v) => setSelectedTemplateId(v ?? "")}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-left",
                          !selectedTemplateLabel && "text-muted-foreground"
                        )}
                      >
                        {selectedTemplateLabel ?? "Choose a template"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!selectedTemplateId || loadBusy}
                  onClick={() => void handleTemplateLoad()}
                >
                  {loadBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Load
                </Button>
              </div>
            )}
          </>
        )}

        {importError && (
          <p className="text-[11px] text-destructive">{importError}</p>
        )}
        {importWarnings.map((w) => (
          <p
            key={w}
            className="text-[11px] text-amber-700 dark:text-amber-400"
          >
            {w}
          </p>
        ))}
      </div>
    </details>
  );
}
