import { describe, expect, it } from "vitest";
import { convertToCytoscapeElements } from "./convertToCytoscapeElements";
import { loadOntology } from "./ontologyRegistry";
import type { OntologyDocument } from "./types";

function documentFixture(
  overrides: Partial<OntologyDocument> = {},
): OntologyDocument {
  return {
    ontologyBase: "https://example.test/ontology/Loans/",
    imports: [],
    classes: [],
    edges: [],
    attributes: [],
    ...overrides,
  };
}

describe("convertToCytoscapeElements", () => {
  it("converts the real CommercialLoans source without changing its shape", async () => {
    const source = await loadOntology(
      "LOAN/LoansSpecific/CommercialLoans.ontology.json",
    );
    const model = convertToCytoscapeElements(source);
    const nodes = [...model.nodeIndex.values()];
    const edges = [...model.edgeIndex.values()];

    expect(source.classes).toHaveLength(1);
    expect(source.edges).toHaveLength(0);
    expect(source.attributes).toHaveLength(1);
    expect(nodes.filter((node) => node.nodeType === "CLASS")).toHaveLength(1);
    expect(nodes.filter((node) => node.nodeType === "EXTERNAL")).toHaveLength(1);
    expect(nodes.filter((node) => node.nodeType === "PROPERTY")).toHaveLength(1);
    expect(edges.some((edge) => edge.edgeType === "SUBCLASS_OF")).toBe(true);
    expect(edges.some((edge) => edge.edgeType === "HAS_PROPERTY")).toBe(true);
    expect(model.propertiesByNodeId.values().next().value).toHaveLength(1);
    expect(model.facets.scopes).toEqual(["external", "internal"]);

    const propertyElement = model.elements.find(
      (element) => element.data.nodeType === "PROPERTY",
    );
    expect(propertyElement?.classes).toContain("property-element");
  });

  it("resolves all five class aliases to the same internal node", () => {
    const ontologyClass = {
      name: "Loan",
      label: "Loan label",
      localName: "LoanLocal",
      technicalName: "loan:Loan",
      iri: "https://example.test/Loan",
      parents: [],
      rules: [],
    };
    const aliases = [
      ontologyClass.name,
      ontologyClass.label,
      ontologyClass.localName,
      ontologyClass.technicalName,
      ontologyClass.iri,
    ];
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [ontologyClass],
        edges: [
          {
            name: "relates to",
            domain: aliases,
            range: ["external:Target"],
          },
        ],
      }),
    );
    const internalId = [...model.nodeIndex.values()].find(
      (node) => node.nodeType === "CLASS",
    )?.id;
    const relationshipSources = [...model.edgeIndex.values()]
      .filter((edge) => edge.edgeType === "ONTOLOGY_RELATIONSHIP")
      .map((edge) => edge.source);

    expect(new Set(relationshipSources)).toEqual(new Set([internalId]));
    expect(model.diagnostics.externalReferences).toEqual(["external:Target"]);
  });

  it("creates a Cartesian product for multiple domain and range values", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        edges: [
          {
            technicalName: "loan:connects",
            domain: ["A", "B"],
            range: ["C", "D"],
          },
        ],
      }),
    );

    expect(
      [...model.edgeIndex.values()].filter(
        (edge) => edge.edgeType === "ONTOLOGY_RELATIONSHIP",
      ),
    ).toHaveLength(4);
    expect(model.diagnostics.externalReferences).toEqual(["A", "B", "C", "D"]);
  });

  it("keeps duplicate identifiers unique", () => {
    const repeatedClass = {
      iri: "https://example.test/Duplicate",
      parents: [],
      rules: [],
    };
    const model = convertToCytoscapeElements(
      documentFixture({ classes: [repeatedClass, repeatedClass] }),
    );

    expect(new Set(model.nodeIndex.keys()).size).toBe(2);
  });

  it("keeps a subclass edge attached to its class when aliases collide", () => {
    const firstClass = {
      name: "Shared label",
      iri: "https://example.test/First",
      parents: [],
      rules: [],
    };
    const secondClass = {
      name: "Shared label",
      iri: "https://example.test/Second",
      parents: ["external:Parent"],
      rules: [],
    };
    const model = convertToCytoscapeElements(
      documentFixture({ classes: [firstClass, secondClass] }),
    );
    const secondNode = [...model.nodeIndex.values()].find(
      (node) => node.iri === secondClass.iri,
    );
    const subclassEdge = [...model.edgeIndex.values()].find(
      (edge) => edge.edgeType === "SUBCLASS_OF",
    );

    expect(subclassEdge?.source).toBe(secondNode?.id);
  });

  it("treats classes with only external parents as local roots", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [
          {
            name: "Loan Application",
            parents: ["cmns-doc:Document"],
            rules: [],
          },
          {
            name: "Loan Contract",
            parents: ["Loan Application", "external:Agreement"],
            rules: [],
          },
        ],
      }),
    );
    const rootLabels = model.rootNodeIds.map(
      (id) => model.nodeIndex.get(id)?.label,
    );

    expect(rootLabels).toEqual(["Loan Application"]);
  });

  it("does not treat classes with an internal parent as roots", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [
          { name: "Root", parents: [], rules: [] },
          { name: "Child", parents: ["Root"], rules: [] },
        ],
      }),
    );
    const rootLabels = model.rootNodeIds.map(
      (id) => model.nodeIndex.get(id)?.label,
    );

    expect(rootLabels).toEqual(["Root"]);
  });

  it("reports missing endpoints and unassigned properties without crashing", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        edges: [{ name: "incomplete", domain: ["Loan"], range: [] }],
        attributes: [
          { name: "unassigned", domain: [], range: [] },
          { name: "assigned", domain: ["Loan"], range: [] },
        ],
      }),
    );

    expect(model.diagnostics.unresolvedRelationships).toHaveLength(1);
    expect(model.diagnostics.unassignedProperties).toHaveLength(1);
    expect([...model.nodeIndex.values()].filter((node) => node.nodeType === "PROPERTY")).toHaveLength(2);
  });
});
