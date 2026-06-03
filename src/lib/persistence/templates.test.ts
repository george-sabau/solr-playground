import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqliteRepository } from "@/lib/persistence";
import { DuplicateTemplateNameError } from "@/lib/persistence/types";
import {
  buildTemplatePayload,
  deserializeTemplatePayload,
  serializeTemplatePayload,
} from "@/lib/query/template-types";
import {
  createFieldConfig,
  DEFAULT_BUILDER_STATE,
  DEFAULT_EDISMAX,
  type QueryParserMode,
} from "@/lib/query/types";
import {
  clearInMemoryDbEnv,
  resetTestPersistence,
  enableInMemoryDb,
} from "./test-helpers";

function sampleBuilder() {
  return {
    ...DEFAULT_BUILDER_STATE,
    searchText: "Par",
    fields: [createFieldConfig("city")],
    edismax: { ...DEFAULT_EDISMAX },
  };
}

describe("query template persistence", () => {
  beforeEach(() => {
    resetTestPersistence();
    enableInMemoryDb();
  });

  afterEach(() => {
    resetTestPersistence();
    clearInMemoryDbEnv();
  });

  it("creates and lists templates scoped to endpoint and core", () => {
    const repo = getSqliteRepository();
    const payload = buildTemplatePayload("lucene", sampleBuilder());

    const id = repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "Paris city search",
      parser: "lucene",
      payload,
    });

    const list = repo.listQueryTemplates("ep-1", "customers");
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(id);
    expect(list[0]?.name).toBe("Paris city search");
    expect(list[0]?.parser).toBe("lucene");
  });

  it("gets template by id with builder payload round-trip", () => {
    const repo = getSqliteRepository();
    const payload = buildTemplatePayload("edismax", sampleBuilder(), "http://example/select");

    const id = repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "Round trip",
      parser: "edismax",
      payload,
    });

    const record = repo.getQueryTemplate(id);
    expect(record).not.toBeNull();
    expect(record?.parser).toBe("edismax");
    expect(record?.payload.sourceUrl).toBe("http://example/select");
    expect(record?.payload.builder.searchText).toBe("Par");
    expect(record?.payload.builder.fields[0]?.field).toBe("city");
  });

  it("deletes template by id", () => {
    const repo = getSqliteRepository();
    const id = repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "To delete",
      parser: "lucene",
      payload: buildTemplatePayload("lucene", sampleBuilder()),
    });

    repo.deleteQueryTemplate(id);
    expect(repo.getQueryTemplate(id)).toBeNull();
    expect(repo.listQueryTemplates("ep-1", "customers")).toHaveLength(0);
  });

  it("rejects duplicate template names per endpoint+core", () => {
    const repo = getSqliteRepository();
    const input = {
      endpointId: "ep-1",
      core: "customers",
      name: "Duplicate me",
      parser: "lucene" as const,
      payload: buildTemplatePayload("lucene", sampleBuilder()),
    };

    repo.createQueryTemplate(input);
    expect(() => repo.createQueryTemplate(input)).toThrow(DuplicateTemplateNameError);
  });

  it("allows same template name on different cores", () => {
    const repo = getSqliteRepository();
    const payload = buildTemplatePayload("lucene", sampleBuilder());

    repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "Shared name",
      parser: "lucene",
      payload,
    });
    repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "products",
      name: "Shared name",
      parser: "lucene",
      payload,
    });

    expect(repo.listQueryTemplates("ep-1", "customers")).toHaveLength(1);
    expect(repo.listQueryTemplates("ep-1", "products")).toHaveLength(1);
  });

  it("serializes and deserializes payload through DB storage", () => {
    const repo = getSqliteRepository();
    const payload = buildTemplatePayload("lucene", sampleBuilder());
    const json = serializeTemplatePayload(payload);
    const parsed = deserializeTemplatePayload(json);

    const id = repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "Serialize test",
      parser: "lucene",
      payload: parsed,
    });

    const stored = repo.getQueryTemplate(id);
    expect(stored?.payload.builder.searchText).toBe("Par");
    expect(stored?.payload.builder.fields).toHaveLength(1);
  });

  it("returns null for unknown template id", () => {
    const repo = getSqliteRepository();
    expect(repo.getQueryTemplate("missing-id")).toBeNull();
  });

  it("lists templates sorted by name", () => {
    const repo = getSqliteRepository();
    const payload = buildTemplatePayload("lucene", sampleBuilder());

    repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "Zebra",
      parser: "lucene",
      payload,
    });
    repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "Alpha",
      parser: "lucene",
      payload,
    });

    const names = repo
      .listQueryTemplates("ep-1", "customers")
      .map((t) => t.name);
    expect(names).toEqual(["Alpha", "Zebra"]);
  });

  it("scopes templates to endpoint id", () => {
    const repo = getSqliteRepository();
    const payload = buildTemplatePayload("lucene", sampleBuilder());

    repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "Ep1",
      parser: "lucene",
      payload,
    });
    repo.createQueryTemplate({
      endpointId: "ep-2",
      core: "customers",
      name: "Ep2",
      parser: "lucene",
      payload,
    });

    expect(repo.listQueryTemplates("ep-1", "customers")).toHaveLength(1);
    expect(repo.listQueryTemplates("ep-2", "customers")).toHaveLength(1);
    expect(repo.listQueryTemplates("ep-1", "customers")[0]?.name).toBe("Ep1");
  });

  it("supports all parser modes", () => {
    const repo = getSqliteRepository();
    const parsers: QueryParserMode[] = ["lucene", "edismax", "dismax"];

    for (const parser of parsers) {
      const id = repo.createQueryTemplate({
        endpointId: "ep-1",
        core: "customers",
        name: `${parser} template`,
        parser,
        payload: buildTemplatePayload(parser, sampleBuilder()),
      });
      expect(repo.getQueryTemplate(id)?.parser).toBe(parser);
    }
  });

  it("delete is idempotent for missing ids", () => {
    const repo = getSqliteRepository();
    expect(() => repo.deleteQueryTemplate("does-not-exist")).not.toThrow();
  });

  it("trims template name on create", () => {
    const repo = getSqliteRepository();
    const id = repo.createQueryTemplate({
      endpointId: "ep-1",
      core: "customers",
      name: "  Trimmed  ",
      parser: "lucene",
      payload: buildTemplatePayload("lucene", sampleBuilder()),
    });

    expect(repo.getQueryTemplate(id)?.name).toBe("Trimmed");
  });
});
