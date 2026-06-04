/** Build Solr /select URLSearchParams with repeated fq and bq. */
export function buildSelectSearchParams(
  q: string,
  extra: Record<string, string>,
  fq: string[],
  bq: string[],
  opts?: { start?: number; rows?: number; fl?: string; sort?: string }
): URLSearchParams {
  const params = new URLSearchParams({
    q,
    wt: "json",
    indent: "true",
    fl: opts?.fl ?? "*,score",
    rows: String(opts?.rows ?? 20),
    start: String(opts?.start ?? 0),
  });
  if (opts?.sort) params.set("sort", opts.sort);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  for (const clause of fq) {
    if (clause.trim()) params.append("fq", clause);
  }
  for (const clause of bq) {
    if (clause.trim()) params.append("bq", clause);
  }
  return params;
}

export function selectParamsToRecord(
  params: URLSearchParams
): Record<string, string> {
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== "fq" && key !== "bq") {
      out[key] = value;
    }
  });
  return out;
}
