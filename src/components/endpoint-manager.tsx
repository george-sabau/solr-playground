"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  DEFAULT_SOLR_BASE_URL,
  endpointDisplayLabel,
  normalizeAuth,
  normalizeBaseUrl,
  type SolrEndpoint,
} from "@/lib/solr/endpoints";
import { testEndpointConnection } from "@/lib/solr-client";
import { useSolrStore } from "@/lib/stores/solr-store";
import { cn } from "@/lib/utils";

const accentButtonClass = cn(
  "border-transparent bg-[var(--solr-accent)] text-[var(--solr-accent-fg)]",
  "shadow-sm hover:bg-[var(--solr-accent-hover)]",
  "focus-visible:border-[var(--solr-accent)] focus-visible:ring-[var(--solr-accent)]/35"
);

type FormMode = { kind: "idle" } | { kind: "add" } | { kind: "edit"; id: string };

function EndpointFormFields({
  label,
  onLabelChange,
  baseUrl,
  onBaseUrlChange,
  user,
  onUserChange,
  pass,
  onPassChange,
}: {
  label: string;
  onLabelChange: (v: string) => void;
  baseUrl: string;
  onBaseUrlChange: (v: string) => void;
  user: string;
  onUserChange: (v: string) => void;
  pass: string;
  onPassChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="grid gap-2">
        <Label htmlFor="ep-label">Label (optional)</Label>
        <Input
          id="ep-label"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g. Local dev"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ep-url">Base URL</Label>
        <Input
          id="ep-url"
          autoComplete="url"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder={DEFAULT_SOLR_BASE_URL}
          className="font-mono text-sm"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ep-user">Basic auth user</Label>
          <Input
            id="ep-user"
            autoComplete="username"
            value={user}
            onChange={(e) => onUserChange(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ep-pass">Basic auth password</Label>
          <Input
            id="ep-pass"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => onPassChange(e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>
    </div>
  );
}

export function EndpointManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const endpoints = useSolrStore((s) => s.endpoints);
  const activeEndpointId = useSolrStore((s) => s.activeEndpointId);
  const addEndpoint = useSolrStore((s) => s.addEndpoint);
  const updateEndpoint = useSolrStore((s) => s.updateEndpoint);
  const removeEndpoint = useSolrStore((s) => s.removeEndpoint);
  const setActiveEndpoint = useSolrStore((s) => s.setActiveEndpoint);
  const refreshCores = useSolrStore((s) => s.refreshCores);

  const [mode, setMode] = useState<FormMode>({ kind: "idle" });
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState(DEFAULT_SOLR_BASE_URL);
  const [draftUser, setDraftUser] = useState("");
  const [draftPass, setDraftPass] = useState("");
  const [busy, setBusy] = useState(false);

  const duplicateUrls = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ep of endpoints) {
      counts.set(ep.baseUrl, (counts.get(ep.baseUrl) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([url]) => url)
    );
  }, [endpoints]);

  const resetForm = useCallback(() => {
    setMode({ kind: "idle" });
    setDraftLabel("");
    setDraftUrl(DEFAULT_SOLR_BASE_URL);
    setDraftUser("");
    setDraftPass("");
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const loadEdit = (ep: SolrEndpoint) => {
    setMode({ kind: "edit", id: ep.id });
    setDraftLabel(ep.label);
    setDraftUrl(ep.baseUrl);
    setDraftUser(ep.auth?.user ?? "");
    setDraftPass(ep.auth?.pass ?? "");
  };

  const startAdd = () => {
    setMode({ kind: "add" });
    setDraftLabel("");
    setDraftUrl(DEFAULT_SOLR_BASE_URL);
    setDraftUser("");
    setDraftPass("");
  };

  const buildDraftAuth = () => normalizeAuth(draftUser, draftPass);

  const validateDraftUrl = (): string | null => {
    const url = normalizeBaseUrl(draftUrl);
    if (!url) {
      toast.error("Invalid base URL — use http:// or https://");
      return null;
    }
    return url;
  };

  const handleTest = async () => {
    const url = validateDraftUrl();
    if (!url) return;
    setBusy(true);
    try {
      const cores = await testEndpointConnection(url, buildDraftAuth());
      toast.success(
        cores.length > 0
          ? `Connected — ${cores.length} core${cores.length === 1 ? "" : "s"} found`
          : "Connected — no cores reported"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const url = validateDraftUrl();
    if (!url) return;
    setBusy(true);
    try {
      const auth = buildDraftAuth();
      if (mode.kind === "add") {
        const id = addEndpoint({
          label: draftLabel,
          baseUrl: url,
          auth,
        });
        await setActiveEndpoint(id);
        toast.success("Endpoint added");
      } else if (mode.kind === "edit") {
        updateEndpoint(mode.id, {
          label: draftLabel,
          baseUrl: url,
          auth,
        });
        if (mode.id === activeEndpointId) {
          await refreshCores();
        }
        toast.success("Endpoint updated");
      }
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save endpoint");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      const wasActive = id === activeEndpointId;
      removeEndpoint(id);
      if (wasActive) {
        await refreshCores();
      }
      if (mode.kind === "edit" && mode.id === id) {
        resetForm();
      }
      toast.success("Endpoint removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove endpoint");
    } finally {
      setBusy(false);
    }
  };

  const showForm = mode.kind !== "idle";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solr endpoints</DialogTitle>
          <DialogDescription>
            Saved connections persist in this browser. Switch endpoints from the
            header dropdown; cores reload automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {endpoints.map((ep) => {
              const isActive = ep.id === activeEndpointId;
              const isDup = duplicateUrls.has(ep.baseUrl);
              return (
                <li
                  key={ep.id}
                  className={cn(
                    "rounded-lg border border-border p-3",
                    isActive && "border-[var(--solr-accent)]/40 bg-muted/25"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {endpointDisplayLabel(ep)}
                        </span>
                        {isActive && (
                          <span className="rounded bg-[var(--solr-accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--solr-accent-muted)]">
                            Active
                          </span>
                        )}
                        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {ep.auth?.user ? "Auth" : "No auth"}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {ep.baseUrl}
                      </p>
                      {isDup && (
                        <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                          Duplicate URL — another entry uses the same base URL.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="size-8"
                        aria-label={`Edit ${endpointDisplayLabel(ep)}`}
                        disabled={busy}
                        onClick={() => loadEdit(ep)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="size-8 text-destructive hover:text-destructive"
                        aria-label={`Delete ${endpointDisplayLabel(ep)}`}
                        disabled={busy}
                        onClick={() => void handleDelete(ep.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {!showForm && (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={startAdd}
              disabled={busy}
            >
              <Plus className="size-4" />
              Add endpoint
            </Button>
          )}

          {showForm && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {mode.kind === "add" ? "New endpoint" : "Edit endpoint"}
              </p>
              <EndpointFormFields
                label={draftLabel}
                onLabelChange={setDraftLabel}
                baseUrl={draftUrl}
                onBaseUrlChange={setDraftUrl}
                user={draftUser}
                onUserChange={setDraftUser}
                pass={draftPass}
                onPassChange={setDraftPass}
              />
              <DialogFooter className="px-0 pb-0 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleTest()}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : null}
                    Test connection
                  </Button>
                  <Button
                    type="button"
                    className={accentButtonClass}
                    disabled={busy}
                    onClick={() => void handleSave()}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
