import type { QueryParserMode } from "@/lib/query/types";
import type { QueryTemplatePayload } from "@/lib/query/template-types";
import type { QueryBuilderTemplateRecord } from "@/lib/persistence/types";

export interface TemplateListItem {
  id: string;
  name: string;
  parser: QueryParserMode;
  createdAt: string;
  updatedAt: string;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    /* response may not be JSON */
  }
  return `${fallback} (${res.status})`;
}

export async function fetchTemplates(
  endpointId: string,
  core: string
): Promise<TemplateListItem[]> {
  const params = new URLSearchParams({ endpointId, core });
  const res = await fetch(`/api/presets/templates?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to load templates"));
  }
  return res.json() as Promise<TemplateListItem[]>;
}

export async function fetchTemplate(
  id: string
): Promise<QueryBuilderTemplateRecord> {
  const res = await fetch(`/api/presets/templates/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to load template"));
  }
  return res.json() as Promise<QueryBuilderTemplateRecord>;
}

export async function createTemplate(input: {
  endpointId: string;
  core: string;
  name: string;
  parser: QueryParserMode;
  payload: QueryTemplatePayload;
}): Promise<{ id: string }> {
  const res = await fetch("/api/presets/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "A template with this name already exists.");
  }
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to save template"));
  }
  return res.json() as Promise<{ id: string }>;
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/presets/templates/${id}`, {
    method: "DELETE",
  });
  if (res.status === 404) {
    throw new Error("Template not found.");
  }
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to delete template"));
  }
}
