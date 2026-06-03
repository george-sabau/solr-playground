import { describe, expect, it } from "vitest";
import { importBuilderFromSolrUrl } from "@/lib/query/import";

describe("importBuilderFromSolrUrl", () => {
  it("imports lucene q from a select URL", () => {
    const result = importBuilderFromSolrUrl(
      "http://localhost:8983/solr/customers/select?q=name:smith&wt=json"
    );
    expect(result.parser).toBe("lucene");
    expect(result.state.searchText).toBe("smith");
    expect(result.state.fields).toHaveLength(1);
    expect(result.state.fields[0]?.field).toBe("name");
  });

  it("throws when q is missing", () => {
    expect(() =>
      importBuilderFromSolrUrl("http://localhost:8983/solr/customers/select")
    ).toThrow(/no q parameter/i);
  });
});
