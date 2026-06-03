import { describe, expect, it } from "vitest";
import {
  createDefaultEndpoint,
  defaultLabelFromUrl,
  endpointDisplayLabel,
  getActiveEndpoint,
  normalizeAuth,
  normalizeBaseUrl,
} from "@/lib/solr/endpoints";

describe("Solr endpoint helpers", () => {
  it("normalizeBaseUrl trims trailing slashes and validates protocol", () => {
    expect(normalizeBaseUrl("http://localhost:8983/solr/")).toBe(
      "http://localhost:8983/solr"
    );
    expect(normalizeBaseUrl("ftp://bad")).toBeNull();
    expect(normalizeBaseUrl("")).toBeNull();
  });

  it("defaultLabelFromUrl uses hostname and port", () => {
    expect(defaultLabelFromUrl("http://localhost:8983/solr")).toBe(
      "localhost:8983"
    );
    expect(defaultLabelFromUrl("https://solr.example/solr")).toBe("solr.example");
  });

  it("endpointDisplayLabel falls back to URL label", () => {
    const ep = createDefaultEndpoint({ label: "" });
    expect(endpointDisplayLabel(ep)).toContain("localhost");
    expect(endpointDisplayLabel({ ...ep, label: "My Solr" })).toBe("My Solr");
  });

  it("getActiveEndpoint returns matching endpoint", () => {
    const a = createDefaultEndpoint({ id: "a" });
    const b = createDefaultEndpoint({ id: "b" });
    expect(getActiveEndpoint({ endpoints: [a, b], activeEndpointId: "b" })?.id).toBe(
      "b"
    );
    expect(
      getActiveEndpoint({ endpoints: [a], activeEndpointId: "missing" })
    ).toBeNull();
  });

  it("normalizeAuth returns null for blank user", () => {
    expect(normalizeAuth("", "pass")).toBeNull();
    expect(normalizeAuth(" admin ", "pass")).toEqual({ user: "admin", pass: "pass" });
  });
});
