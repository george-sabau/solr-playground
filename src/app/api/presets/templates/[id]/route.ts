import { NextResponse } from "next/server";
import { getSqliteRepository } from "@/lib/persistence";
import { formatDbError } from "@/lib/persistence/db-errors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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
