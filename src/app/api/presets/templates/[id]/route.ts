import { NextResponse } from "next/server";
import { getSqliteRepository } from "@/lib/persistence";
import { formatDbError } from "@/lib/persistence/db-errors";
import type { QueryTemplatePayload } from "@/lib/query/template-types";
import { buildTemplatePayload } from "@/lib/query/template-types";
import type { QueryParserMode } from "@/lib/query/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const PARSERS: QueryParserMode[] = ["lucene", "edismax", "dismax"];

function isParser(v: unknown): v is QueryParserMode {
  return typeof v === "string" && PARSERS.includes(v as QueryParserMode);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repo = getSqliteRepository();
    const record = repo.getQueryTemplate(id);
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(record);
  } catch (e) {
    const message = formatDbError(e);
    console.error("[templates GET id]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const body = raw as { parser?: unknown; payload?: QueryTemplatePayload };
    if (!isParser(body.parser)) {
      return NextResponse.json({ error: "Invalid parser" }, { status: 400 });
    }
    let payload = body.payload;
    if (!payload || payload.version !== 1) {
      return NextResponse.json(
        { error: "Invalid template payload" },
        { status: 400 }
      );
    }
    payload = buildTemplatePayload(
      payload.parser,
      payload.builder,
      payload.sourceUrl
    );
    const repo = getSqliteRepository();
    const existing = repo.getQueryTemplate(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    repo.updateQueryTemplate(id, {
      parser: body.parser,
      payload,
    });
    return NextResponse.json({ id, name: existing.name });
  } catch (e) {
    const message = formatDbError(e);
    console.error("[templates PUT]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const repo = getSqliteRepository();
    const existing = repo.getQueryTemplate(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    repo.deleteQueryTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = formatDbError(e);
    console.error("[templates DELETE]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
