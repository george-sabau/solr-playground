export const DEFAULT_SOLR_BASE_URL = "http://localhost:8983/solr";
export const DEFAULT_ENDPOINT_ID = "default-local";

export interface SolrAuth {
  user: string;
  pass: string;
}

export interface SolrEndpoint {
  id: string;
  label: string;
  baseUrl: string;
  auth: SolrAuth | null;
  lastCore: string | null;
}

export interface SolrEndpointInput {
  label?: string;
  baseUrl: string;
  auth?: SolrAuth | null;
}

export function normalizeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function defaultLabelFromUrl(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    const port =
      (u.protocol === "http:" && u.port === "80") ||
      (u.protocol === "https:" && u.port === "443") ||
      !u.port
        ? u.hostname
        : `${u.hostname}:${u.port}`;
    return port || baseUrl;
  } catch {
    return baseUrl;
  }
}

export function endpointDisplayLabel(endpoint: SolrEndpoint): string {
  const trimmed = endpoint.label.trim();
  return trimmed.length > 0 ? trimmed : defaultLabelFromUrl(endpoint.baseUrl);
}

export function createDefaultEndpoint(
  overrides?: Partial<SolrEndpoint>
): SolrEndpoint {
  return {
    id: DEFAULT_ENDPOINT_ID,
    label: "Local",
    baseUrl: DEFAULT_SOLR_BASE_URL,
    auth: null,
    lastCore: null,
    ...overrides,
  };
}

export function getActiveEndpoint(state: {
  endpoints: SolrEndpoint[];
  activeEndpointId: string;
}): SolrEndpoint | null {
  return (
    state.endpoints.find((e) => e.id === state.activeEndpointId) ?? null
  );
}

export function normalizeAuth(
  user: string,
  pass: string
): SolrAuth | null {
  const trimmedUser = user.trim();
  if (!trimmedUser) return null;
  return { user: trimmedUser, pass };
}
