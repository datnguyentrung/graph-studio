import { describe, expect, it } from "vitest";
import { resolveRoute } from "./routeResolver";

describe("resolveRoute", () => {
  it("keeps the root route backward compatible with Mermaid", () => {
    expect(resolveRoute("/")).toMatchObject({
      kind: "page",
      segment: "mermaid",
      subPath: "",
    });
  });

  it.each([
    ["/mermaid", "mermaid", ""],
    ["/mermaid/team/loan", "mermaid", "team/loan"],
    ["/ontology", "ontology", ""],
    ["/ontology/loan/commercial", "ontology", "loan/commercial"],
  ])("resolves %s by its first segment", (pathname, id, subPath) => {
    expect(resolveRoute(pathname)).toMatchObject({
      kind: "page",
      segment: id,
      subPath,
    });
  });

  it("returns not-found for an unknown segment", () => {
    expect(resolveRoute("/unknown/child")).toEqual({
      kind: "not-found",
      segment: "unknown",
      subPath: "child",
    });
  });
});
