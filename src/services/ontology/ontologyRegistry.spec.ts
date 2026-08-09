import { describe, expect, it } from "vitest";
import {
  getDefaultOntologyPath,
  getOntologyPaths,
  hasOntology,
  loadOntology,
  resolveOntologyPath,
} from "./ontologyRegistry";

describe("ontologyRegistry", () => {
  it("discovers only ontology JSON files as normalized relative paths", () => {
    const paths = getOntologyPaths();

    expect(paths.length).toBeGreaterThan(0);
    expect(paths).toContain("all.ontology.json");
    expect(paths).toContain(
      "LOAN/LoansSpecific/CommercialLoans.ontology.json",
    );
    expect(paths.every((path) => path.endsWith(".ontology.json"))).toBe(true);
    expect(paths.every((path) => !path.includes("\\"))).toBe(true);
  });

  it("resolves stored selections and falls back to the default", () => {
    const validPath = "LOAN/LoansSpecific/CommercialLoans.ontology.json";

    expect(hasOntology(validPath)).toBe(true);
    expect(resolveOntologyPath(validPath)).toBe(validPath);
    expect(resolveOntologyPath("removed.ontology.json")).toBe(
      getDefaultOntologyPath(),
    );
    expect(resolveOntologyPath(null)).toBe(getDefaultOntologyPath());
  });

  it("loads a discovered ontology and rejects unknown paths", async () => {
    const document = await loadOntology(
      "LOAN/LoansSpecific/CommercialLoans.ontology.json",
    );

    expect(document.classes).toHaveLength(1);
    await expect(loadOntology("missing.ontology.json")).rejects.toThrow(
      "Ontology source was not found: missing.ontology.json",
    );
  });
});
