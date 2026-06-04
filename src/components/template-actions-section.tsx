"use client";

import { Label } from "@/components/ui/label";
import {
  SaveTemplateDialog,
  type LoadedTemplateRef,
} from "@/components/save-template-dialog";
import type { BuilderState, QueryParserMode } from "@/lib/query/types";

export function TemplateActionsSection({
  endpointId,
  core,
  baseUrl,
  parser,
  builderState,
  fieldTypes,
  loadedTemplate,
  onLoadedTemplateClear,
  onTemplatesChanged,
}: {
  endpointId: string;
  core: string;
  baseUrl: string;
  parser: QueryParserMode;
  builderState: BuilderState;
  fieldTypes?: Record<string, string | undefined>;
  loadedTemplate: LoadedTemplateRef | null;
  onLoadedTemplateClear?: () => void;
  onTemplatesChanged?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/15 p-3">
      <Label className="text-xs">Templates</Label>
      {loadedTemplate && (
        <p className="text-[11px] text-muted-foreground">
          Loaded{" "}
          <span className="font-medium text-foreground">
            {loadedTemplate.name}
          </span>
          . Edit the builder, then{" "}
          <span className="font-medium text-foreground">Update template</span>.
          Use <span className="font-medium text-foreground">Save as new…</span>{" "}
          for a copy with a different name.
        </p>
      )}
      <SaveTemplateDialog
        endpointId={endpointId}
        core={core}
        baseUrl={baseUrl}
        parser={parser}
        builderState={builderState}
        fieldTypes={fieldTypes}
        loadedTemplate={loadedTemplate}
        onLoadedTemplateClear={onLoadedTemplateClear}
        onTemplatesChanged={onTemplatesChanged}
      />
    </div>
  );
}
