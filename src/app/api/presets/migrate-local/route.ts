import { NextResponse } from "next/server";
import { getPersistenceRepository } from "@/lib/persistence";
import { formatDbError } from "@/lib/persistence/db-errors";
import { connectionStateFromLegacyPayload } from "@/lib/persistence/legacy-migrate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { payload?: unknown };
    const parsed = connectionStateFromLegacyPayload(body.payload);
    if (!parsed) {
      return NextResponse.json(
        { migrated: false, reason: "invalid_payload" },
        { status: 400 }
      );
    }

    const repo = getPersistenceRepository();
    if (repo.hasAnyEndpoints()) {
      return NextResponse.json({ migrated: false, reason: "not_empty" });
    }

    repo.saveConnectionState(parsed);
    return NextResponse.json({ migrated: true });
  } catch (e) {
    const message = formatDbError(e);
    console.error("[migrate-local POST]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
