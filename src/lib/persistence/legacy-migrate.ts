import {
  createDefaultEndpoint,
  DEFAULT_SOLR_BASE_URL,
  normalizeBaseUrl,
  type SolrAuth,
  type SolrEndpoint,
} from "@/lib/solr/endpoints";
import type { ConnectionState } from "./types";

type PersistedV0 = {
  baseUrl?: string;
  auth?: SolrAuth | null;
  currentCore?: string | null;
  endpoints?: SolrEndpoint[];
  activeEndpointId?: string;
};

type ZustandPersistEnvelope = {
  state?: PersistedV0;
  version?: number;
};

/** Parse zustand persist localStorage JSON into ConnectionState. */
export function connectionStateFromLegacyPayload(
  payload: unknown
): ConnectionState | null {
  if (!payload || typeof payload !== "object") return null;

  const envelope = payload as ZustandPersistEnvelope & PersistedV0;
  const inner =
    envelope.state && typeof envelope.state === "object"
      ? envelope.state
      : (envelope as PersistedV0);

  if (inner.endpoints?.length && inner.activeEndpointId) {
    return {
      endpoints: inner.endpoints,
      activeEndpointId: inner.activeEndpointId,
    };
  }

  const baseUrl =
    normalizeBaseUrl(inner.baseUrl ?? DEFAULT_SOLR_BASE_URL) ??
    DEFAULT_SOLR_BASE_URL;
  const endpoint = createDefaultEndpoint({
    baseUrl,
    auth: inner.auth ?? null,
    lastCore: inner.currentCore ?? null,
  });

  return {
    endpoints: [endpoint],
    activeEndpointId: endpoint.id,
  };
}
