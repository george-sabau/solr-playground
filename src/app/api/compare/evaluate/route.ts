import { NextResponse } from "next/server";
import {
  CompareAiNotConfiguredError,
  evaluateCompare,
  isCompareAiAvailable,
} from "@/lib/ai/compare";
import type { CompareMetricsResult } from "@/lib/query/compare-metrics";
import type { SelectResponse } from "@/types/solr";

export const runtime = "nodejs";

interface EvaluateBody {
  searchTerm?: string;
  sideA?: {
    label?: string;
    qSummary?: string;
    parser?: string;
    response?: SelectResponse;
  };
  sideB?: {
    label?: string;
    qSummary?: string;
    parser?: string;
    response?: SelectResponse;
  };
  metrics?: CompareMetricsResult;
}

function isSelectResponse(value: unknown): value is SelectResponse {
  if (!value || typeof value !== "object") return false;
  const r = value as SelectResponse;
  return (
    !!r.response &&
    Array.isArray(r.response.docs) &&
    typeof r.response.numFound === "number"
  );
}

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
    const body = raw as EvaluateBody;
    const searchTerm = body.searchTerm?.trim() ?? "";

    if (
      !isSelectResponse(body.sideA?.response) ||
      !isSelectResponse(body.sideB?.response) ||
      !body.metrics
    ) {
      return NextResponse.json(
        {
          error:
            "Both sides need full Solr responses and deterministic metrics.",
        },
        { status: 400 }
      );
    }

    const evaluation = await evaluateCompare({
      searchTerm,
      sideA: {
        label: body.sideA.label ?? "Source A",
        qSummary: body.sideA.qSummary ?? "",
        parser: body.sideA.parser ?? "lucene",
        response: body.sideA.response,
      },
      sideB: {
        label: body.sideB.label ?? "Source B",
        qSummary: body.sideB.qSummary ?? "",
        parser: body.sideB.parser ?? "lucene",
        response: body.sideB.response,
      },
      metrics: body.metrics,
    });

    return NextResponse.json({ evaluation });
  } catch (e) {
    if (e instanceof CompareAiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Evaluation failed";
    console.error("[compare/evaluate POST]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
