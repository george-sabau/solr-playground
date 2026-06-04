"use client";

import { useCallback, useState } from "react";
import { BookmarkPlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSelectRequestUrl,
  compileBuilderSearch,
} from "@/lib/query/compile";
import { buildTemplatePayload } from "@/lib/query/template-types";
import type { BuilderState, QueryParserMode } from "@/lib/query/types";
import {
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
  type TemplateListItem,
} from "@/lib/templates-api";

export interface LoadedTemplateRef {
  id: string;
  name: string;
}

function buildPayloadForSave(
  baseUrl: string,
  core: string,
  parser: QueryParserMode,
  builderState: BuilderState,
  fieldTypes?: Record<string, string | undefined>
) {
  const plan = compileBuilderSearch(builderState, parser, { fieldTypes });
  const { upstream } = buildSelectRequestUrl(
    baseUrl,
    core,
    plan.q,
    plan.extra,
    { fq: plan.fq, bq: plan.bq }
  );
  return buildTemplatePayload(parser, builderState, upstream);
}

export function SaveTemplateDialog({
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
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    if (!endpointId || !core) {
      setTemplates([]);
      return;
    }
    setListLoading(true);
    try {
      setTemplates(await fetchTemplates(endpointId, core));
    } catch {
      setTemplates([]);
    } finally {
      setListLoading(false);
    }
  }, [endpointId, core]);

  const handleManageOpenChange = (next: boolean) => {
    setManageOpen(next);
    if (next) void refreshList();
  };

  const handleCreateOpenChange = (next: boolean) => {
    setCreateOpen(next);
    if (next) {
      setCreateError(null);
      setName("");
    }
  };

  const handleUpdate = async () => {
    if (!loadedTemplate) return;
    setUpdating(true);
    try {
      const payload = buildPayloadForSave(
        baseUrl,
        core,
        parser,
        builderState,
        fieldTypes
      );
      await updateTemplate(loadedTemplate.id, { parser, payload });
      toast.success(`Updated template "${loadedTemplate.name}"`);
      onTemplatesChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update template");
    } finally {
      setUpdating(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setCreateError(null);
    try {
      const payload = buildPayloadForSave(
        baseUrl,
        core,
        parser,
        builderState,
        fieldTypes
      );
      await createTemplate({
        endpointId,
        core,
        name: trimmed,
        parser,
        payload,
      });
      toast.success(`Saved template "${trimmed}"`);
      setName("");
      setCreateOpen(false);
      await refreshList();
      onTemplatesChanged?.();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save template";
      setCreateError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, templateName: string) => {
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      toast.success(`Deleted "${templateName}"`);
      if (loadedTemplate?.id === id) {
        onLoadedTemplateClear?.();
      }
      await refreshList();
      onTemplatesChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete template");
    } finally {
      setDeletingId(null);
    }
  };

  const duplicateHint =
    loadedTemplate &&
    name.trim().toLowerCase() === loadedTemplate.name.toLowerCase();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {loadedTemplate ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-md border border-[var(--solr-accent)]/35 bg-[var(--solr-accent)]/8 px-2.5 py-1.5 sm:w-auto sm:flex-1 sm:justify-end">
          <span className="text-[10px] text-muted-foreground">Editing</span>
          <span
            className="max-w-[12rem] truncate text-xs font-medium"
            title={loadedTemplate.name}
          >
            {loadedTemplate.name}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 text-xs border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)] hover:bg-[var(--solr-accent-hover)]"
            disabled={updating}
            onClick={() => void handleUpdate()}
          >
            {updating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Pencil className="size-3.5" />
            )}
            Update template
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-0.5 px-1.5 text-[10px] text-muted-foreground"
            onClick={onLoadedTemplateClear}
            title="Stop editing this template (changes stay in the builder)"
          >
            <X className="size-3" />
            Clear
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => handleCreateOpenChange(true)}
      >
        <BookmarkPlus className="size-3.5" />
        {loadedTemplate ? "Save as new…" : "Save as template"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-muted-foreground"
        onClick={() => handleManageOpenChange(true)}
      >
        Manage
      </Button>

      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {loadedTemplate ? "Save as new template" : "New query template"}
            </DialogTitle>
            <DialogDescription>
              {loadedTemplate
                ? `Creates a new template. To overwrite "${loadedTemplate.name}", use Update template instead.`
                : `Save the current builder for core ${core}. Names must be unique — load an existing template under Load from source, then use Update template to change it.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="template-name" className="text-xs">
              Name
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (createError) setCreateError(null);
              }}
              placeholder="e.g. customers from paris search v2"
              aria-invalid={!!createError}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
            {duplicateHint && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                This name matches the template you are editing. Use{" "}
                <strong>Update template</strong> to save changes, or pick a
                different name for a copy.
              </p>
            )}
            {createError && (
              <p className="text-[11px] text-destructive" role="alert">
                {createError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              disabled={!name.trim() || saving || !!duplicateHint}
              onClick={() => void handleCreate()}
              className="border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)] hover:bg-[var(--solr-accent-hover)]"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save new template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={handleManageOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Templates for {core}</DialogTitle>
            <DialogDescription>
              Saved setups for this endpoint and core. Delete unused templates
              here.
            </DialogDescription>
          </DialogHeader>
          {listLoading ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">None saved yet.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                >
                  <span className="truncate">
                    {t.name}
                    {loadedTemplate?.id === t.id ? (
                      <span className="ml-1.5 text-[10px] text-[var(--solr-accent)]">
                        (editing)
                      </span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${t.name}`}
                    disabled={deletingId === t.id}
                    onClick={() => void handleDelete(t.id, t.name)}
                  >
                    {deletingId === t.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
