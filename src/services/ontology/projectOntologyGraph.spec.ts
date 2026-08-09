import { describe, expect, it } from "vitest";
import { convertToCytoscapeElements } from "./convertToCytoscapeElements";
import { loadOntology } from "./ontologyRegistry";
import {
  chooseOntologyRenderingStrategy,
  createDefaultGraphView,
  getOntologyNeighborhoodIds,
  ONTOLOGY_GRAPH_BUDGET,
  projectOntologyGraph,
  toggleHierarchyExpansion,
  toFocusView,
  toHierarchyViewForNode,
} from "./projectOntologyGraph";
import type { CytoscapeGraphModel, OntologyDocument } from "./types";
import { createDefaultFilters, type VisibilityState } from "./visibilityTypes";

function documentFixture(
  overrides: Partial<OntologyDocument> = {},
): OntologyDocument {
  return {
    ontologyBase: "https://example.test/ontology/Projection/",
    imports: [],
    classes: [],
    edges: [],
    attributes: [],
    ...overrides,
  };
}

function classFixture(name: string, parents: string[] = []) {
  return {
    name,
    label: name,
    technicalName: `test:${name}`,
    iri: `https://example.test/${name}`,
    parents,
    rules: [],
  };
}

function visibility(
  model: CytoscapeGraphModel,
  overrides: Partial<VisibilityState> = {},
): VisibilityState {
  return {
    ...createDefaultFilters(model.facets),
    manuallyHiddenIds: new Set(),
    isolatedIds: null,
    revealedIds: new Set(),
    ...overrides,
  };
}

describe("projectOntologyGraph", () => {
  it("builds a deterministic progressive overview from ontology locations", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [
          {
            ...classFixture("Loan"),
            iri: "https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansGeneral/Loan",
          },
          {
            ...classFixture("Security"),
            iri: "https://spec.edmcouncil.org/fibo/ontology/SEC/Securities/Security",
          },
        ],
      }),
    );
    const result = projectOntologyGraph(
      model,
      { mode: "overview" },
      visibility(model),
    );
    const labels = result.elements
      .filter((element) => !element.data.source)
      .map((element) => String(element.data.label).split("\n")[0]);

    expect(labels).toEqual(["LOAN", "SEC", "FIBO"]);
    expect(result.edgeIds).toHaveLength(2);
  });

  it("projects the full visible graph by default", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [
          classFixture("Root"),
          classFixture("Child", ["Root"]),
          classFixture("Grandchild", ["Child"]),
          classFixture("TooDeep", ["Grandchild"]),
        ],
      }),
    );
    const result = projectOntologyGraph(
      model,
      createDefaultGraphView(),
      visibility(model),
    );
    const labels = result.nodeIds.map((id) => model.nodeIndex.get(id)?.label);

    expect(labels).toEqual(["Child", "Grandchild", "Root", "TooDeep"]);
    expect(result.truncated).toBe(false);
    expect(result.edgeIds).toHaveLength(3);
  });

  it("focuses and expands through the full-model adjacency index", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [
          classFixture("Root"),
          classFixture("Child", ["Root"]),
          classFixture("Grandchild", ["Child"]),
        ],
      }),
    );
    const childId = [...model.nodeIndex.values()].find(
      (node) => node.label === "Child",
    )?.id;
    expect(childId).toBeTruthy();

    const neighborhood = getOntologyNeighborhoodIds(model, [childId!], 1);
    const labels = neighborhood.nodeIds.map(
      (id) => model.nodeIndex.get(id)?.label,
    );
    expect(labels).toEqual(["Child", "Grandchild", "Root"]);

    const result = projectOntologyGraph(
      model,
      toFocusView(model, [childId!], 1),
      visibility(model),
    );
    expect(result.nodeIds).toEqual(neighborhood.nodeIds);
  });

  it("enforces progressive node and edge budgets without orphan edges", () => {
    const classes = Array.from({ length: 720 }, (_, index) =>
      ({
        ...classFixture(`Class-${String(index).padStart(3, "0")}`),
        iri: `https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansGeneral/Class${index}`,
        parents: index === 0 ? [] : [`Class-${String(index - 1).padStart(3, "0")}`],
      }),
    );
    const model = convertToCytoscapeElements(documentFixture({ classes }));
    const expandedClassIds = [...model.nodeIndex.values()]
      .filter((node) => node.nodeType === "CLASS")
      .map((node) => node.id);
    const result = projectOntologyGraph(
      model,
      {
        mode: "hierarchy",
        expandedDomainIds: ["LOAN"],
        expandedModuleIds: ["LOAN/LoansGeneral"],
        expandedClassIds,
        relationshipSeedNodeIds: [],
      },
      visibility(model),
    );
    const nodeSet = new Set(result.nodeIds);

    expect(result.nodeIds).toHaveLength(ONTOLOGY_GRAPH_BUDGET.maxNodes);
    expect(result.edgeIds.length).toBeLessThanOrEqual(
      ONTOLOGY_GRAPH_BUDGET.maxEdges,
    );
    expect(result.truncated).toBe(true);
    for (const edgeId of result.edgeIds) {
      const edge = model.edgeIndex.get(edgeId);
      if (!edge) continue;
      expect(nodeSet.has(edge.source)).toBe(true);
      expect(nodeSet.has(edge.target)).toBe(true);
    }
  });

  it("applies filters before materialising elements", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [classFixture("Visible"), classFixture("Hidden")],
      }),
    );
    const visibleNode = [...model.nodeIndex.values()].find(
      (node) => node.label === "Visible",
    )!;
    const result = projectOntologyGraph(
      model,
      {
        mode: "hierarchy",
        expandedDomainIds: ["test"],
        expandedModuleIds: ["test/Ungrouped"],
        expandedClassIds: [],
        relationshipSeedNodeIds: [],
      },
      visibility(model, {
        enabledNamespaces: new Set([visibleNode.namespace]),
        manuallyHiddenIds: new Set(
          [...model.nodeIndex.values()]
            .filter((node) => node.label === "Hidden")
            .map((node) => node.id),
        ),
      }),
    );

    expect(result.nodeIds).toContain(visibleNode.id);
    expect(result.nodeIds).not.toContain(
      [...model.nodeIndex.values()].find((node) => node.label === "Hidden")?.id,
    );
  });

  it("chooses progressive rendering for the aggregate ontology without losing the store", async () => {
    const model = convertToCytoscapeElements(
      await loadOntology("all.ontology.json"),
    );
    const result = projectOntologyGraph(
      model,
      createDefaultGraphView("progressive"),
      visibility(model),
    );

    expect(model.nodeIndex.size).toBe(3342);
    expect(model.edgeIndex.size).toBe(4929);
    expect(chooseOntologyRenderingStrategy(model)).toBe("progressive");
    expect(result.nodeIds.length).toBeLessThan(3342);
    expect(result.nodeIds).toHaveLength(12);
    expect(result.edgeIds).toHaveLength(11);
  });

  it("opens a collapsed aggregate node through its domain and module path", async () => {
    const model = convertToCytoscapeElements(
      await loadOntology("all.ontology.json"),
    );
    const node = [...model.nodeIndex.values()].find(
      (candidate) =>
        candidate.nodeType === "CLASS" &&
        model.locationByNodeId.get(candidate.id)?.domain === "LOAN",
    );
    expect(node).toBeTruthy();

    const view = toHierarchyViewForNode(model, node!.id);
    const result = projectOntologyGraph(model, view, visibility(model));

    expect(result.nodeIds).toContain("view:domain:LOAN");
    expect(result.nodeIds.some((id) => id.startsWith("view:module:LOAN/"))).toBe(true);
    expect(result.nodeIds).toContain(node!.id);
  });

  it("keeps the parent branch while toggling domain, module, and class nodes", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [
          {
            ...classFixture("Root"),
            iri: "https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansGeneral/Root",
          },
          {
            ...classFixture("Child", ["Root"]),
            iri: "https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansGeneral/Child",
          },
          {
            ...classFixture("Grandchild", ["Child"]),
            iri: "https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansGeneral/Grandchild",
          },
        ],
      }),
    );
    const rootId = [...model.nodeIndex.values()].find((node) => node.label === "Root")!.id;
    const childId = [...model.nodeIndex.values()].find((node) => node.label === "Child")!.id;

    const domainView = toggleHierarchyExpansion(model, { mode: "overview" }, "view:domain:LOAN");
    const moduleView = toggleHierarchyExpansion(
      model,
      domainView,
      "view:module:LOAN/LoansGeneral",
    );
    const rootView = toggleHierarchyExpansion(model, moduleView, rootId);
    const childView = toggleHierarchyExpansion(model, rootView, childId);

    expect(childView).toMatchObject({
      mode: "hierarchy",
      expandedDomainIds: ["LOAN"],
      expandedModuleIds: ["LOAN/LoansGeneral"],
      expandedClassIds: [childId, rootId].sort(),
    });

    const collapsedRootView = toggleHierarchyExpansion(model, childView, rootId);
    expect(collapsedRootView).toMatchObject({
      expandedDomainIds: ["LOAN"],
      expandedModuleIds: ["LOAN/LoansGeneral"],
      expandedClassIds: [],
    });
  });

  it("connects module roots and materialises hierarchy, relationship, and property edges", () => {
    const model = convertToCytoscapeElements(
      documentFixture({
        classes: [
          {
            ...classFixture("Root"),
            iri: "https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansGeneral/Root",
          },
          {
            ...classFixture("Child", ["Root"]),
            iri: "https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansGeneral/Child",
          },
        ],
        edges: [{ name: "relates to", domain: ["Root"], range: ["Child"] }],
        attributes: [{ name: "amount", domain: ["Root"], range: ["decimal"] }],
      }),
    );
    const rootId = [...model.nodeIndex.values()].find((node) => node.label === "Root")!.id;
    const childId = [...model.nodeIndex.values()].find((node) => node.label === "Child")!.id;
    const view = toggleHierarchyExpansion(
      model,
      {
        mode: "hierarchy",
        expandedDomainIds: ["LOAN"],
        expandedModuleIds: ["LOAN/LoansGeneral"],
        expandedClassIds: [],
        relationshipSeedNodeIds: [],
      },
      rootId,
    );
    const result = projectOntologyGraph(model, view, visibility(model));
    const projectedEdges = result.elements.filter((element) => element.data.source);

    expect(result.nodeIds).toContain(rootId);
    expect(result.nodeIds).toContain(childId);
    expect(projectedEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({
          source: "view:module:LOAN/LoansGeneral",
          target: rootId,
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ edgeType: "SUBCLASS_OF", source: childId, target: rootId }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ edgeType: "ONTOLOGY_RELATIONSHIP", source: rootId, target: childId }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ edgeType: "HAS_PROPERTY", source: rootId }),
      }),
    ]));
    for (const edge of projectedEdges) {
      expect(result.nodeIds).toContain(String(edge.data.source));
      expect(result.nodeIds).toContain(String(edge.data.target));
    }
  });

  it("renders the LOAN aggregate source beyond the old two-node overview trap", async () => {
    const model = convertToCytoscapeElements(
      await loadOntology("LOAN/all_loan.ontology.json"),
    );
    const result = projectOntologyGraph(
      model,
      createDefaultGraphView(),
      visibility(model),
    );
    const nodeSet = new Set(result.nodeIds);

    expect(chooseOntologyRenderingStrategy(model)).toBe("full");
    expect(result.nodeIds.length).toBeGreaterThan(2);
    expect(result.nodeIds).toHaveLength(model.nodeIndex.size);
    for (const edgeId of result.edgeIds) {
      const edge = model.edgeIndex.get(edgeId)!;
      expect(nodeSet.has(edge.source)).toBe(true);
      expect(nodeSet.has(edge.target)).toBe(true);
    }
  });
});
