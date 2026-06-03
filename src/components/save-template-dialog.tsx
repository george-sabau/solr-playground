"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Loader2, Trash2 } from "lucide-react";
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
  type TemplateListItem,
} from "@/lib/templates-api";

export function SaveTemplateDialog({
  endpointId,
  core,
  baseUrl,
  parser,
  builderState,
  onTemplatesChanged,
}: {
  endpointId: string;
  core: string;
  baseUrl: string;
  parser: QueryParserMode;
  builderState: BuilderState;
  onTemplatesChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (open) {
      void refreshList();
    }
  }, [open, refreshList]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const plan = compileBuilderSearch(builderState, parser);
      const { upstream } = buildSelectRequestUrl(
        baseUrl,
        core,
        plan.q,
        plan.extra
      );
      const payload = buildTemplatePayload(parser, builderState, upstream);
      await createTemplate({
        endpointId,
        core,
        name: trimmed,
        parser,
        payload,
      });
      toast.success(`Saved template "${trimmed}"`);
      setName("");
      await refreshList();
      onTemplatesChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, templateName: string) => {
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      toast.success(`Deleted "${templateName}"`);
      await refreshList();
      onTemplatesChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete template");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <BookmarkPlus className="size-3.5" />
        Save as template
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Query template</DialogTitle>
          <DialogDescription>
            Save the current builder setup for core{" "}
            <span className="font-mono text-foreground">{core}</span>. Names must
            be unique per endpoint and core.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="template-name" className="text-xs">
            Name
          </Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. customers from paris search"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            size="sm"
            disabled={!name.trim() || saving}
            onClick={() => void handleSave()}
            className="border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)] hover:bg-[var(--solr-accent-hover)]"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
        <div className="border-t border-border/80 pt-3">
          <p className="mb-2 text-xs font-medium">Templates for this core</p>
          {listLoading ? (
            <p className="text-[11px] text-muted-foreground">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">None saved yet.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                >
                  <span className="truncate">{t.name}</span>
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
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
