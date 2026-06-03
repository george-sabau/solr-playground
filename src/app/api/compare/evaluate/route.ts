import { NextResponse } from "next/server";
import type { SlimCompareDoc } from "@/lib/query/compare-slim-doc";

export const runtime = "nodejs";

function resolveApiKey(): string | undefined {
  return (
    process.env.COMPARE_AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    undefined
  );
}

function resolveModel(): string {
  return process.env.COMPARE_AI_MODEL?.trim() || "gpt-4o-mini";
}

interface EvaluateBody {
  searchTerm?: string;
  sideA?: {
    label?: string;
    qSummary?: string;
    parser?: string;
    docs?: SlimCompareDoc[];
  };
  sideB?: {
    label?: string;
    qSummary?: string;
    parser?: string;
    docs?: SlimCompareDoc[];
  };
}

export async function GET() {
  return NextResponse.json({ available: !!resolveApiKey() });
}

export async function POST(request: Request) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI evaluation is not configured. Set OPENAI_API_KEY or COMPARE_AI_API_KEY on the server.",
      },
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
    if (!body.sideA?.docs?.length || !body.sideB?.docs?.length) {
      return NextResponse.json(
        { error: "Both sides need result documents to evaluate." },
        { status: 400 }
      );
    }

    const payload = JSON.stringify(
      {
        searchTerm,
        sideA: {
          label: body.sideA.label ?? "Source A",
          qSummary: body.sideA.qSummary ?? "",
          parser: body.sideA.parser ?? "lucene",
          docs: body.sideA.docs.slice(0, 10),
        },
        sideB: {
          label: body.sideB.label ?? "Source B",
          qSummary: body.sideB.qSummary ?? "",
          parser: body.sideB.parser ?? "lucene",
          docs: body.sideB.docs.slice(0, 10),
        },
      },
      null,
      0
    ).slice(0, 12000);

    const systemPrompt = `You are a search relevance judge for Apache Solr A/B experiments.
Given a user search term and two ranked top-10 result lists (with field snippets), decide which query produced more relevant results overall.
Respond with JSON only, no markdown, matching this schema:
{
  "winner": "a" | "b" | "tie",
  "confidence": "low" | "medium" | "high",
  "reasons": string[],
  "perSideNotes": { "a": string, "b": string },
  "caveats": string[]
}
Be concise. Consider snippet match to the search term, score ordering, and diversity of good hits.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveModel(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Evaluate relevance for search term: "${searchTerm}"\n\n${payload}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || `OpenAI API error (${res.status})` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Empty response from AI provider." },
        { status: 502 }
      );
    }

    const evaluation = JSON.parse(content) as {
      winner?: string;
      confidence?: string;
      reasons?: string[];
      perSideNotes?: { a?: string; b?: string };
      caveats?: string[];
    };

    const winner =
      evaluation.winner === "a" ||
      evaluation.winner === "b" ||
      evaluation.winner === "tie"
        ? evaluation.winner
        : "tie";

    const confidence =
      evaluation.confidence === "low" ||
      evaluation.confidence === "medium" ||
      evaluation.confidence === "high"
        ? evaluation.confidence
        : "medium";

    return NextResponse.json({
      evaluation: {
        winner,
        confidence,
        reasons: Array.isArray(evaluation.reasons)
          ? evaluation.reasons.map(String)
          : [],
        perSideNotes: {
          a: evaluation.perSideNotes?.a ?? "",
          b: evaluation.perSideNotes?.b ?? "",
        },
        caveats: Array.isArray(evaluation.caveats)
          ? evaluation.caveats.map(String)
          : [],
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Evaluation failed";
    console.error("[compare/evaluate POST]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
