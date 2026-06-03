import type {
  CompareAiEvaluateInput,
  CompareAiPayload,
  SerializedCompareSide,
} from "@/lib/ai/compare/types";
import type { SelectResponse, SolrDoc, SolrFieldValue } from "@/types/solr";

const SYSTEM_FIELDS = new Set([
  "_version_",
  "_root_",
  "_nest_path_",
  "_text_",
  "score",
]);

const MAX_FIELD_CHARS = 500;
const MAX_PAYLOAD_BYTES = 90_000;

function isInternalField(name: string): boolean {
  return (
    SYSTEM_FIELDS.has(name) ||
    (name.startsWith("_") && name.endsWith("_"))
  );
}

function truncateValue(value: SolrFieldValue, maxChars = MAX_FIELD_CHARS): SolrFieldValue {
  if (typeof value === "string") {
    return value.length <= maxChars ? value : `${value.slice(0, maxChars - 1)}…`;
  }
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === "string" && v.length > maxChars) {
        return `${v.slice(0, maxChars - 1)}…`;
      }
      return v;
    });
  }
  return value;
}

export function sanitizeSolrDoc(doc: SolrDoc): SolrDoc {
  const out: SolrDoc = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) continue;
    if (isInternalField(key)) continue;
    out[key] = truncateValue(value);
  }
  return out;
}

export function sanitizeSelectResponse(response: SelectResponse): SelectResponse {
  return {
    responseHeader: response.responseHeader,
    response: {
      ...response.response,
      docs: response.response.docs.map(sanitizeSolrDoc),
    },
    ...(response.error ? { error: response.error } : {}),
  };
}

function serializeSide(
  label: string,
  qSummary: string,
  parser: string,
  response: SelectResponse
): SerializedCompareSide {
  return {
    label,
    qSummary,
    parser,
    solrResponse: sanitizeSelectResponse(response),
  };
}

function shrinkPayload(payload: CompareAiPayload): CompareAiPayload {
  let json = JSON.stringify(payload);
  if (json.length <= MAX_PAYLOAD_BYTES) return payload;

  const shrinkSide = (side: SerializedCompareSide): SerializedCompareSide => ({
    ...side,
    solrResponse: {
      ...side.solrResponse,
      response: {
        ...side.solrResponse.response,
        docs: side.solrResponse.response.docs.map((doc) => {
          const minimal: SolrDoc = { id: doc.id, score: doc.score };
          const keys = Object.keys(doc).filter(
            (k) => k !== "id" && k !== "score" && !isInternalField(k)
          );
          for (const key of keys.slice(0, 3)) {
            const v = doc[key];
            if (v !== undefined) minimal[key] = truncateValue(v, 200);
          }
          return minimal;
        }),
      },
    },
  });

  const shrunk: CompareAiPayload = {
    ...payload,
    sideA: shrinkSide(payload.sideA),
    sideB: shrinkSide(payload.sideB),
  };

  json = JSON.stringify(shrunk);
  if (json.length > MAX_PAYLOAD_BYTES) {
    throw new Error(
      "Compare payload too large for AI evaluation even after truncation."
    );
  }
  return shrunk;
}

export function buildCompareAiPayload(
  input: CompareAiEvaluateInput
): CompareAiPayload {
  const payload: CompareAiPayload = {
    searchTerm: input.searchTerm,
    sideA: serializeSide(
      input.sideA.label,
      input.sideA.qSummary,
      input.sideA.parser,
      input.sideA.response
    ),
    sideB: serializeSide(
      input.sideB.label,
      input.sideB.qSummary,
      input.sideB.parser,
      input.sideB.response
    ),
    deterministicMetrics: input.metrics,
  };
  return shrinkPayload(payload);
}
