import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const HEADER_BASE = "x-solr-base-url";
const HEADER_AUTH = "x-solr-auth";

function normalizeBaseUrl(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

async function proxy(request: NextRequest, pathSegments: string[] | undefined) {
  const base = normalizeBaseUrl(request.headers.get(HEADER_BASE));
  if (!base) {
    return NextResponse.json(
      { error: "Missing or invalid x-solr-base-url header" },
      { status: 400 }
    );
  }

  const path = (pathSegments ?? []).join("/");
  const search = request.nextUrl.searchParams.toString();
  const target = `${base}/${path}${search ? `?${search}` : ""}`;

  const headers = new Headers();
  const authB64 = request.headers.get(HEADER_AUTH);
  if (authB64) {
    headers.set("Authorization", `Basic ${authB64}`);
  }
  const accept = request.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const method = request.method;
  const body =
    method !== "GET" && method !== "HEAD" ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const outHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) outHeaders.set("Content-Type", ct);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path);
}
