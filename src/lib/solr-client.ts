import { getActiveEndpoint } from "@/lib/solr/endpoints";
import type { SolrAuth } from "@/lib/solr/endpoints";
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

export function buildSolrHeadersFrom(
  baseUrl: string,
  auth: SolrAuth | null
): Headers {
  const headers = new Headers();
  headers.set(HEADER_BASE, baseUrl.trim().replace(/\/+$/, ""));
  if (auth?.user) {
    headers.set(HEADER_AUTH, authHeaderValue(auth.user, auth.pass ?? ""));
  }
  return headers;
}

function buildSolrHeaders(): Headers {
  const active = getActiveEndpoint(useSolrStore.getState());
  if (!active) {
    throw new Error("No active Solr endpoint configured");
  }
  return buildSolrHeadersFrom(active.baseUrl, active.auth);
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

async function solrJsonWithHeaders<T>(
  path: string,
  searchParams: Record<string, string> | undefined,
  headers: Headers
): Promise<T> {
  const trimmed = path.replace(/^\/+/, "");
  const qs = new URLSearchParams(searchParams ?? {});
  const q = qs.toString();
  const url = `/api/solr/${trimmed}${q ? `?${q}` : ""}`;
  headers.set("Accept", "application/json");
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
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

async function solrJsonWithUrlParams<T>(
  path: string,
  params: URLSearchParams
): Promise<T> {
  const trimmed = path.replace(/^\/+/, "");
  const q = params.toString();
  const url = `/api/solr/${trimmed}${q ? `?${q}` : ""}`;
  const headers = buildSolrHeaders();
  headers.set("Accept", "application/json");
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCoresStatus(): Promise<string[]> {
  const active = getActiveEndpoint(useSolrStore.getState());
  if (!active) return [];
  return fetchCoresStatusForEndpoint(active);
}

export async function fetchCoresStatusForEndpoint(
  connection: { baseUrl: string; auth: SolrAuth | null }
): Promise<string[]> {
  const headers = buildSolrHeadersFrom(connection.baseUrl, connection.auth);
  const data = await solrJsonWithHeaders<CoresStatusResponse>(
    "admin/cores",
    { action: "STATUS", wt: "json" },
    headers
  );
  if (!data.status || typeof data.status !== "object") return [];
  return Object.keys(data.status);
}

export async function testEndpointConnection(
  baseUrl: string,
  auth: SolrAuth | null
): Promise<string[]> {
  return fetchCoresStatusForEndpoint({ baseUrl, auth });
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

import { buildSelectSearchParams } from "@/lib/query/select-params";

export interface RunSelectParams {
  q: string;
  rows?: number;
  start?: number;
  fl?: string;
  sort?: string;
  extra?: Record<string, string>;
  fq?: string[];
  bq?: string[];
}

export function runSelect(
  core: string,
  params: RunSelectParams
): Promise<SelectResponse> {
  const urlParams = buildSelectSearchParams(
    params.q,
    params.extra ?? {},
    params.fq ?? [],
    params.bq ?? [],
    {
      rows: params.rows,
      start: params.start,
      fl: params.fl,
      sort: params.sort,
    }
  );
  return solrJsonWithUrlParams<SelectResponse>(`${core}/select`, urlParams);
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
