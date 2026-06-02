import { useSolrStore } from "@/lib/stores/solr-store";
import type {
  AnalysisResponse,
  CoresStatusResponse,
  SchemaCopyFieldsResponse,
  SchemaDynamicFieldsResponse,
  SchemaFieldTypesResponse,
  SchemaFieldsResponse,
  SelectResponse,
} from "@/types/solr";

const HEADER_BASE = "x-solr-base-url";
const HEADER_AUTH = "x-solr-auth";

function authHeaderValue(user: string, pass: string): string {
  const pair = `${user}:${pass}`;
  if (typeof btoa === "function") {
    return btoa(pair);
  }
  return Buffer.from(pair, "utf8").toString("base64");
}

function buildSolrHeaders(): Headers {
  const { baseUrl, auth } = useSolrStore.getState();
  const headers = new Headers();
  headers.set(HEADER_BASE, baseUrl.trim().replace(/\/+$/, ""));
  if (auth?.user) {
    headers.set(HEADER_AUTH, authHeaderValue(auth.user, auth.pass ?? ""));
  }
  return headers;
}

export async function solrFetch(
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string> }
): Promise<Response> {
  const trimmed = path.replace(/^\/+/, "");
  const qs = new URLSearchParams(init?.searchParams ?? {});
  const q = qs.toString();
  const url = `/api/solr/${trimmed}${q ? `?${q}` : ""}`;
  const headers = buildSolrHeaders();
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  }
  return fetch(url, {
    ...init,
    headers,
  });
}

export async function solrJson<T>(
  path: string,
  searchParams?: Record<string, string>
): Promise<T> {
  const res = await solrFetch(path, {
    searchParams,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCoresStatus(): Promise<string[]> {
  const data = await solrJson<CoresStatusResponse>("admin/cores", {
    action: "STATUS",
    wt: "json",
  });
  if (!data.status || typeof data.status !== "object") return [];
  return Object.keys(data.status);
}

export function fetchSchemaFields(core: string): Promise<SchemaFieldsResponse> {
  return solrJson<SchemaFieldsResponse>(`${core}/schema/fields`, { wt: "json" });
}

export function fetchSchemaDynamicFields(
  core: string
): Promise<SchemaDynamicFieldsResponse> {
  return solrJson<SchemaDynamicFieldsResponse>(`${core}/schema/dynamicfields`, {
    wt: "json",
  });
}

export function fetchSchemaFieldTypes(
  core: string
): Promise<SchemaFieldTypesResponse> {
  return solrJson<SchemaFieldTypesResponse>(`${core}/schema/fieldtypes`, {
    wt: "json",
    showDefaults: "true",
  });
}

export function fetchSchemaCopyFields(
  core: string
): Promise<SchemaCopyFieldsResponse> {
  return solrJson<SchemaCopyFieldsResponse>(`${core}/schema/copyfields`, {
    wt: "json",
  });
}

export interface RunSelectParams {
  q: string;
  rows?: number;
  start?: number;
  fl?: string;
  sort?: string;
  extra?: Record<string, string>;
}

export function runSelect(
  core: string,
  params: RunSelectParams
): Promise<SelectResponse> {
  const search: Record<string, string> = {
    wt: "json",
    indent: "true",
    fl: params.fl ?? "*,score",
    rows: String(params.rows ?? 20),
    start: String(params.start ?? 0),
    q: params.q,
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.extra ?? {}),
  };
  return solrJson<SelectResponse>(`${core}/select`, search);
}

export function runFieldAnalysis(
  core: string,
  fieldname: string,
  value: string
): Promise<AnalysisResponse> {
  return solrJson<AnalysisResponse>(`${core}/analysis/field`, {
    wt: "json",
    "analysis.fieldname": fieldname,
    "analysis.fieldvalue": value,
  });
}
