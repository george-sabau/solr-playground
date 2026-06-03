import { getDocKey } from "@/lib/query/compare-doc-key";
import type { BuilderState, SearchPlan } from "@/lib/query/types";
import type { SelectResponse, SolrDoc } from "@/types/solr";

export interface SideMetrics {
  label: string;
  qSummary: string;
  parser: string;
  selectedFieldCount: number;
  numFound: number;
  qTime: number | null;
  wallTimeMs: number;
  maxScore: number | null;
  avgScoreTop10: number | null;
  minScoreTop10: number | null;
  maxScoreTop10: number | null;
}

export interface OverlapMetrics {
  overlapCount: number;
  overlapPercent: number;
  onlyInA: number;
  onlyInB: number;
  onlyInAIds: string[];
  onlyInBIds: string[];
  jaccardTop10: number;
  avgRankDisplacement: number | null;
  maxRankDisplacement: number | null;
  avgScoreDeltaShared: number | null;
}

export interface HeuristicMetrics {
  topScoreRatio: number | null;
  numFoundRatio: number | null;
}

export interface CompareMetricsResult {
  searchTerm: string;
  sideA: SideMetrics;
  sideB: SideMetrics;
  overlap: OverlapMetrics;
  heuristics: HeuristicMetrics;
  hints: string[];
}

function scoresFromDocs(docs: SolrDoc[]): number[] {
  return docs
    .map((d) => d.score)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildSideMetrics(
  label: string,
  plan: SearchPlan,
  builder: BuilderState,
  response: SelectResponse | null,
  wallTimeMs: number
): SideMetrics {
  const docs = response?.response.docs ?? [];
  const scores = scoresFromDocs(docs);
  return {
    label,
    qSummary: plan.summary,
    parser: plan.extra.defType ?? "lucene",
    selectedFieldCount: builder.fields.length,
    numFound: response?.response.numFound ?? 0,
    qTime: response?.responseHeader.QTime ?? null,
    wallTimeMs,
    maxScore:
      response?.response.maxScore ??
      (scores.length > 0 ? Math.max(...scores) : null),
    avgScoreTop10: avg(scores),
    minScoreTop10: scores.length > 0 ? Math.min(...scores) : null,
    maxScoreTop10: scores.length > 0 ? Math.max(...scores) : null,
  };
}

function rankMap(docs: SolrDoc[]): Map<string, number> {
  const m = new Map<string, number>();
  docs.forEach((doc, i) => m.set(getDocKey(doc, i), i + 1));
  return m;
}

function computeOverlap(docsA: SolrDoc[], docsB: SolrDoc[]): OverlapMetrics {
  const keysA = docsA.map((d, i) => getDocKey(d, i));
  const keysB = docsB.map((d, i) => getDocKey(d, i));
  const setA = new Set(keysA);
  const setB = new Set(keysB);
  const intersection = keysA.filter((k) => setB.has(k));
  const union = new Set([...keysA, ...keysB]);
  const onlyInAIds = keysA.filter((k) => !setB.has(k));
  const onlyInBIds = keysB.filter((k) => !setA.has(k));

  const rankA = rankMap(docsA);
  const rankB = rankMap(docsB);
  const displacements: number[] = [];
  const scoreDeltas: number[] = [];

  for (const key of intersection) {
    const ra = rankA.get(key)!;
    const rb = rankB.get(key)!;
    displacements.push(Math.abs(ra - rb));
    const docA = docsA[ra - 1];
    const docB = docsB[rb - 1];
    if (
      typeof docA?.score === "number" &&
      typeof docB?.score === "number"
    ) {
      scoreDeltas.push(docA.score - docB.score);
    }
  }

  const denom = Math.max(docsA.length, docsB.length, 1);

  return {
    overlapCount: intersection.length,
    overlapPercent: (intersection.length / denom) * 100,
    onlyInA: onlyInAIds.length,
    onlyInB: onlyInBIds.length,
    onlyInAIds,
    onlyInBIds,
    jaccardTop10:
      union.size === 0 ? 0 : intersection.length / union.size,
    avgRankDisplacement: avg(displacements),
    maxRankDisplacement:
      displacements.length > 0 ? Math.max(...displacements) : null,
    avgScoreDeltaShared: avg(scoreDeltas),
  };
}

function buildHints(
  sideA: SideMetrics,
  sideB: SideMetrics,
  overlap: OverlapMetrics
): string[] {
  const hints: string[] = [];
  if (sideA.qTime != null && sideB.qTime != null && sideA.qTime !== sideB.qTime) {
    const faster = sideA.qTime < sideB.qTime ? "A" : "B";
    const delta = Math.abs(sideA.qTime - sideB.qTime);
    hints.push(`Source ${faster} reported lower Solr QTime (${delta}ms difference).`);
  }
  if (sideA.wallTimeMs !== sideB.wallTimeMs) {
    const faster =
      sideA.wallTimeMs < sideB.wallTimeMs ? "A" : "B";
    const delta = Math.abs(sideA.wallTimeMs - sideB.wallTimeMs).toFixed(0);
    hints.push(`Source ${faster} finished sooner end-to-end (${delta}ms wall-clock).`);
  }
  if (
    sideA.maxScore != null &&
    sideB.maxScore != null &&
    sideA.maxScore !== sideB.maxScore
  ) {
    const higher = sideA.maxScore > sideB.maxScore ? "A" : "B";
    hints.push(
      `Source ${higher} has higher top score (${sideA.maxScore.toFixed(3)} vs ${sideB.maxScore.toFixed(3)}).`
    );
  }
  if (sideA.numFound !== sideB.numFound) {
    hints.push(
      `Total hits: A ${sideA.numFound.toLocaleString()} vs B ${sideB.numFound.toLocaleString()}.`
    );
  }
  hints.push(
    `${overlap.overlapCount} of top 10 appear in both lists (Jaccard ${(overlap.jaccardTop10 * 100).toFixed(0)}%).`
  );
  return hints;
}

export function computeCompareMetrics(input: {
  searchTerm: string;
  labelA: string;
  labelB: string;
  planA: SearchPlan;
  planB: SearchPlan;
  builderA: BuilderState;
  builderB: BuilderState;
  responseA: SelectResponse | null;
  responseB: SelectResponse | null;
  wallTimeA: number;
  wallTimeB: number;
}): CompareMetricsResult {
  const docsA = input.responseA?.response.docs ?? [];
  const docsB = input.responseB?.response.docs ?? [];
  const sideA = buildSideMetrics(
    input.labelA,
    input.planA,
    input.builderA,
    input.responseA,
    input.wallTimeA
  );
  const sideB = buildSideMetrics(
    input.labelB,
    input.planB,
    input.builderB,
    input.responseB,
    input.wallTimeB
  );
  const overlap = computeOverlap(docsA, docsB);

  let topScoreRatio: number | null = null;
  if (sideA.maxScore != null && sideB.maxScore != null && sideB.maxScore > 0) {
    topScoreRatio = sideA.maxScore / sideB.maxScore;
  }

  let numFoundRatio: number | null = null;
  if (sideB.numFound > 0) {
    numFoundRatio = sideA.numFound / sideB.numFound;
  }

  return {
    searchTerm: input.searchTerm,
    sideA,
    sideB,
    overlap,
    heuristics: { topScoreRatio, numFoundRatio },
    hints: buildHints(sideA, sideB, overlap),
  };
}
