import { NextResponse } from "next/server";
import { getSqliteRepository } from "@/lib/persistence";
import { DuplicateTemplateNameError } from "@/lib/persistence/types";
import { formatDbError } from "@/lib/persistence/db-errors";
import type { QueryTemplatePayload } from "@/lib/query/template-types";
import { buildTemplatePayload } from "@/lib/query/template-types";
import type { QueryParserMode } from "@/lib/query/types";

export const runtime = "nodejs";

const PARSERS: QueryParserMode[] = ["lucene", "edismax", "dismax"];

function isParser(v: unknown): v is QueryParserMode {
  return typeof v === "string" && PARSERS.includes(v as QueryParserMode);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get("endpointId")?.trim();
    const core = searchParams.get("core")?.trim();
    if (!endpointId || !core) {
      return NextResponse.json(
        { error: "endpointId and core are required" },
        { status: 400 }
      );
    }
    const repo = getSqliteRepository();
    const list = repo.listQueryTemplates(endpointId, core);
    return NextResponse.json(
      list.map((t) => ({
        id: t.id,
        name: t.name,
        parser: t.parser,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }))
    );
  } catch (e) {
    const message = formatDbError(e);
    console.error("[templates GET]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const body = raw as {
      endpointId?: string;
      core?: string;
      name?: string;
      parser?: unknown;
      payload?: QueryTemplatePayload;
    };
    const endpointId = body.endpointId?.trim();
    const core = body.core?.trim();
    const name = body.name?.trim();
    if (!endpointId || !core || !name) {
      return NextResponse.json(
        { error: "endpointId, core, and name are required" },
        { status: 400 }
      );
    }
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
    const id = repo.createQueryTemplate({
      endpointId,
      core,
      name,
      parser: body.parser,
      payload,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateTemplateNameError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const message = formatDbError(e);
    console.error("[templates POST]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
