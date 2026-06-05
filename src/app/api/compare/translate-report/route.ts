import { NextResponse } from "next/server";
import { isCompareAiAvailable } from "@/lib/ai/compare";
import { CompareAiNotConfiguredError } from "@/lib/ai/compare/evaluator";
import { translateReportToBusiness } from "@/lib/ai/compare/report-translator";
import {
  parseCompareReportPayload,
  type CompareReportPayload,
} from "@/lib/compare/report-payload";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ available: isCompareAiAvailable() });
}

export async function POST(request: Request) {
  if (!isCompareAiAvailable()) {
    return NextResponse.json(
      { error: new CompareAiNotConfiguredError().message },
      { status: 503 }
    );
  }

  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const body = raw as { payload?: unknown };
    const payloadRaw =
      typeof body.payload === "string"
        ? body.payload
        : JSON.stringify(body.payload ?? null);

    const payload = parseCompareReportPayload(payloadRaw);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or incomplete report payload." },
        { status: 400 }
      );
    }

    const narrative = await translateReportToBusiness(
      stripPayloadForTranslation(payload)
    );

    return NextResponse.json({ narrative });
  } catch (e) {
    if (e instanceof CompareAiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message =
      e instanceof Error ? e.message : "Business report translation failed";
    console.error("[compare/translate-report POST]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Drop business narrative if re-sent; translator always works from technical facts. */
function stripPayloadForTranslation(
  payload: CompareReportPayload
): CompareReportPayload {
  return {
    ...payload,
    audience: "technical",
    business: null,
  };
}
