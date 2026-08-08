import { describe, expect, it } from "vitest";
import type { OntologyNodeData } from "../../services/ontology/types";
import { matchesNodeSearch, matchesTextFilters } from "./searchOntology";

const node: OntologyNodeData = {
  id: "node:loan",
  elementType: "node",
  nodeType: "CLASS",
  type: "CLASS",
  scope: "internal",
  namespace: "fibo-loan",
  ontologyGroup: "CommercialLoans",
  name: "commercial loan",
  label: "Commercial loan",
  localName: "CommercialLoan",
  technicalName: "fibo-loan:CommercialLoan",
  iri: "https://example.test/CommercialLoan",
  parents: [],
  rules: [],
};

describe("ontology search", () => {
  it.each(["commercial", "CommercialLoan", "fibo-loan", "example.test"])(
    "matches %s across supported identity fields",
    (query) => expect(matchesNodeSearch(node, query)).toBe(true),
  );

  it("does not treat an empty query as a result", () => {
    expect(matchesNodeSearch(node, " ")).toBe(false);
  });

  it("matches field filters case-insensitively and supports arrays", () => {
    expect(
      matchesTextFilters(
        {
          label: "Has borrower",
          technicalName: "loan:hasBorrower",
          namespace: "loan",
          domain: ["Commercial loan"],
          range: ["Legal entity"],
        },
        {
          label: "borrower",
          technicalName: "HASBORROWER",
          namespace: "LOAN",
          domain: "commercial",
          range: "entity",
        },
      ),
    ).toBe(true);
  });
});
