import { NextResponse } from "next/server";
import {
  getPersistenceRepository,
  getSqliteRepository,
} from "@/lib/persistence";
import type { ConnectionState } from "@/lib/persistence/types";
import { createDefaultEndpoint, type SolrEndpoint } from "@/lib/solr/endpoints";

export const runtime = "nodejs";

function isValidConnectionState(body: unknown): body is ConnectionState {
  if (!body || typeof body !== "object") return false;
  const b = body as ConnectionState;
  if (!Array.isArray(b.endpoints) || typeof b.activeEndpointId !== "string") {
    return false;
  }
  return b.endpoints.every(
    (ep) =>
      ep &&
      typeof ep === "object" &&
      typeof (ep as SolrEndpoint).id === "string" &&
      typeof (ep as SolrEndpoint).baseUrl === "string"
  );
}

export async function GET() {
  try {
    const repo = getSqliteRepository();
    const state = repo.seedDefaultIfEmpty();
    if (
      state.endpoints.length === 0 ||
      !state.endpoints.some((e) => e.id === state.activeEndpointId)
    ) {
      const endpoint = createDefaultEndpoint();
      const fallback: ConnectionState = {
        endpoints: [endpoint],
        activeEndpointId: endpoint.id,
      };
      repo.saveConnectionState(fallback);
      return NextResponse.json(fallback);
    }
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const raw: unknown = await request.json();
    if (!isValidConnectionState(raw)) {
      return NextResponse.json(
        { error: "Invalid connection state" },
        { status: 400 }
      );
    }
    let state = raw;
    if (!state.endpoints.some((e) => e.id === state.activeEndpointId)) {
      return NextResponse.json(
        { error: "activeEndpointId must match an endpoint" },
        { status: 400 }
      );
    }
    if (state.endpoints.length === 0) {
      const endpoint = createDefaultEndpoint();
      state = {
        endpoints: [endpoint],
        activeEndpointId: endpoint.id,
      };
    }
    getPersistenceRepository().saveConnectionState(state);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
