"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSolrStore } from "@/lib/stores/solr-store";
import { cn } from "@/lib/utils";

export function ConnectionSettings() {
  const baseUrl = useSolrStore((s) => s.baseUrl);
  const auth = useSolrStore((s) => s.auth);
  const setBaseUrl = useSolrStore((s) => s.setBaseUrl);
  const setAuth = useSolrStore((s) => s.setAuth);
  const refreshCores = useSolrStore((s) => s.refreshCores);

  const [open, setOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState(baseUrl);
  const [draftUser, setDraftUser] = useState(auth?.user ?? "");
  const [draftPass, setDraftPass] = useState(auth?.pass ?? "");
  const [applying, setApplying] = useState(false);

  const syncDraft = () => {
    setDraftUrl(baseUrl);
    setDraftUser(auth?.user ?? "");
    setDraftPass(auth?.pass ?? "");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) syncDraft();
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      setBaseUrl(draftUrl);
      const trimmedUser = draftUser.trim();
      if (trimmedUser) {
        setAuth({ user: trimmedUser, pass: draftPass });
      } else {
        setAuth(null);
      }
      await refreshCores();
      toast.success("Connection updated");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach Solr");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "size-8"
        )}
        aria-label="Connection settings"
      >
        <Settings2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <PopoverHeader>
          <PopoverTitle>Solr connection</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-3 pt-1">
          <div className="grid gap-2">
            <Label htmlFor="solr-base-url">Base URL</Label>
            <Input
              id="solr-base-url"
              autoComplete="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="http://localhost:8983/solr"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="solr-user">Basic auth user (optional)</Label>
            <Input
              id="solr-user"
              autoComplete="username"
              value={draftUser}
              onChange={(e) => setDraftUser(e.target.value)}
              placeholder="username"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="solr-pass">Basic auth password (optional)</Label>
            <Input
              id="solr-pass"
              type="password"
              autoComplete="current-password"
              value={draftPass}
              onChange={(e) => setDraftPass(e.target.value)}
              placeholder="password"
            />
          </div>
          <Button type="button" onClick={handleApply} disabled={applying}>
            {applying ? "Applying…" : "Apply & refresh cores"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
