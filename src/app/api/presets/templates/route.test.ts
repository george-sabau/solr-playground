import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/presets/templates/route";
import { GET as GET_BY_ID, DELETE } from "@/app/api/presets/templates/[id]/route";
import { getSqliteRepository } from "@/lib/persistence";
import {
  readJson,
  sampleTemplatePayload,
  setupPresetsApiTests,
  teardownPresetsApiTests,
} from "@/app/api/presets/test-helpers";

const ENDPOINT = "default-local";
const CORE = "customers";

function templatesUrl(query?: Record<string, string>) {
  const url = new URL("http://localhost/api/presets/templates");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

describe("GET /api/presets/templates", () => {
  beforeEach(setupPresetsApiTests);
  afterEach(teardownPresetsApiTests);

  it("requires endpointId and core", async () => {
    const res = await GET(new Request(templatesUrl()));
    expect(res.status).toBe(400);
    expect(await readJson<{ error: string }>(res)).toMatchObject({
      error: "endpointId and core are required",
    });
  });

  it("returns empty list for unknown endpoint/core", async () => {
    const res = await GET(
      new Request(templatesUrl({ endpointId: ENDPOINT, core: CORE }))
    );
    expect(res.status).toBe(200);
    expect(await readJson<unknown[]>(res)).toEqual([]);
  });

  it("lists saved templates without payload", async () => {
    const repo = getSqliteRepository();
    const id = repo.createQueryTemplate({
      endpointId: ENDPOINT,
      core: CORE,
      name: "Listed",
      parser: "lucene",
      payload: sampleTemplatePayload(),
    });

    const res = await GET(
      new Request(templatesUrl({ endpointId: ENDPOINT, core: CORE }))
    );
    const list = await readJson<
      { id: string; name: string; parser: string; createdAt: string }[]
    >(res);

    expect(res.status).toBe(200);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(id);
    expect(list[0]?.name).toBe("Listed");
    expect(list[0]).not.toHaveProperty("payload");
  });
});

describe("POST /api/presets/templates", () => {
  beforeEach(setupPresetsApiTests);
  afterEach(teardownPresetsApiTests);

  it("creates a template", async () => {
    const res = await POST(
      new Request("http://localhost/api/presets/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: ENDPOINT,
          core: CORE,
          name: "New template",
          parser: "lucene",
          payload: sampleTemplatePayload(),
        }),
      })
    );

    expect(res.status).toBe(201);
    const { id } = await readJson<{ id: string }>(res);
    expect(id).toBeTruthy();

    const record = getSqliteRepository().getQueryTemplate(id);
    expect(record?.name).toBe("New template");
    expect(record?.payload.builder.searchText).toBe("Par");
  });

  it("validates required fields", async () => {
    const res = await POST(
      new Request("http://localhost/api/presets/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId: ENDPOINT }),
      })
    );

    expect(res.status).toBe(400);
    expect(await readJson<{ error: string }>(res)).toMatchObject({
      error: "endpointId, core, and name are required",
    });
  });

  it("rejects invalid parser", async () => {
    const res = await POST(
      new Request("http://localhost/api/presets/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: ENDPOINT,
          core: CORE,
          name: "Bad parser",
          parser: "invalid",
          payload: sampleTemplatePayload(),
        }),
      })
    );

    expect(res.status).toBe(400);
    expect(await readJson<{ error: string }>(res)).toMatchObject({
      error: "Invalid parser",
    });
  });

  it("returns 409 for duplicate name", async () => {
    const body = {
      endpointId: ENDPOINT,
      core: CORE,
      name: "Duplicate",
      parser: "lucene",
      payload: sampleTemplatePayload(),
    };

    const first = await POST(
      new Request("http://localhost/api/presets/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    expect(first.status).toBe(201);

    const second = await POST(
      new Request("http://localhost/api/presets/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

    expect(second.status).toBe(409);
    expect(await readJson<{ error: string }>(second)).toMatchObject({
      error: expect.stringContaining("Duplicate"),
    });
  });
});

describe("GET /api/presets/templates/[id]", () => {
  beforeEach(setupPresetsApiTests);
  afterEach(teardownPresetsApiTests);

  it("returns full template record", async () => {
    const repo = getSqliteRepository();
    const id = repo.createQueryTemplate({
      endpointId: ENDPOINT,
      core: CORE,
      name: "Full",
      parser: "edismax",
      payload: sampleTemplatePayload("edismax"),
    });

    const res = await GET_BY_ID(new Request(`http://localhost/api/presets/templates/${id}`), {
      params: Promise.resolve({ id }),
    });

    expect(res.status).toBe(200);
    const record = await readJson<{
      id: string;
      name: string;
      parser: string;
      payload: { version: number; builder: { searchText: string } };
    }>(res);

    expect(record.id).toBe(id);
    expect(record.parser).toBe("edismax");
    expect(record.payload.version).toBe(1);
    expect(record.payload.builder.searchText).toBe("Par");
  });

  it("returns 404 for missing id", async () => {
    const res = await GET_BY_ID(
      new Request("http://localhost/api/presets/templates/missing"),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(res.status).toBe(404);
    expect(await readJson<{ error: string }>(res)).toMatchObject({
      error: "Not found",
    });
  });
});

describe("DELETE /api/presets/templates/[id]", () => {
  beforeEach(setupPresetsApiTests);
  afterEach(teardownPresetsApiTests);

  it("deletes an existing template", async () => {
    const repo = getSqliteRepository();
    const id = repo.createQueryTemplate({
      endpointId: ENDPOINT,
      core: CORE,
      name: "Delete me",
      parser: "lucene",
      payload: sampleTemplatePayload(),
    });

    const res = await DELETE(
      new Request(`http://localhost/api/presets/templates/${id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id }) }
    );

    expect(res.status).toBe(200);
    expect(await readJson<{ ok: boolean }>(res)).toEqual({ ok: true });
    expect(repo.getQueryTemplate(id)).toBeNull();
  });

  it("returns 404 when template does not exist", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/presets/templates/missing", { method: "DELETE" }),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(res.status).toBe(404);
  });
});
