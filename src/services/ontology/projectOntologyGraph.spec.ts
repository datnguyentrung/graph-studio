import { describe, expect, it } from "vitest";
import { convertToCytoscapeElements } from "./convertToCytoscapeElements";
import { loadOntology } from "./ontologyRegistry";
import {
  createDefaultGraphView,
  getOntologyNeighborhoodIds,
  ONTOLOGY_GRAPH_BUDGET,
  projectOntologyGraph,
  toFocusView,
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
  it("builds a deterministic two-level overview from root classes", () => {
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
      { mode: "overview", depth: ONTOLOGY_GRAPH_BUDGET.overviewDepth },
      visibility(model),
    );
    const labels = result.nodeIds.map((id) => model.nodeIndex.get(id)?.label);

    expect(labels).toEqual(["Child", "Grandchild", "Root"]);
    expect(labels).not.toContain("TooDeep");
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

  it("enforces node and edge budgets without orphan edges", () => {
    const classes = Array.from({ length: 420 }, (_, index) =>
      classFixture(`Root-${String(index).padStart(3, "0")}`),
    );
    const model = convertToCytoscapeElements(documentFixture({ classes }));
    const result = projectOntologyGraph(
      model,
      { mode: "overview", depth: ONTOLOGY_GRAPH_BUDGET.overviewDepth },
      visibility(model),
    );
    const nodeSet = new Set(result.nodeIds);

    expect(result.nodeIds).toHaveLength(ONTOLOGY_GRAPH_BUDGET.maxNodes);
    expect(result.edgeIds.length).toBeLessThanOrEqual(
      ONTOLOGY_GRAPH_BUDGET.maxEdges,
    );
    expect(result.truncated).toBe(true);
    for (const edgeId of result.edgeIds) {
      const edge = model.edgeIndex.get(edgeId)!;
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
      { mode: "overview", depth: ONTOLOGY_GRAPH_BUDGET.overviewDepth },
      visibility(model, {
        enabledNamespaces: new Set([visibleNode.namespace]),
        manuallyHiddenIds: new Set(
          [...model.nodeIndex.values()]
            .filter((node) => node.label === "Hidden")
            .map((node) => node.id),
        ),
      }),
    );

    expect(result.nodeIds).toEqual([visibleNode.id]);
  });

  it("renders the aggregate ontology in full view by default", async () => {
    const model = convertToCytoscapeElements(
      await loadOntology("all.ontology.json"),
    );
    const result = projectOntologyGraph(
      model,
      createDefaultGraphView(),
      visibility(model),
    );

    expect(model.nodeIndex.size).toBe(3342);
    expect(model.edgeIndex.size).toBe(4929);
    expect(result.nodeIds).toHaveLength(3342);
    expect(result.edgeIds).toHaveLength(4929);
    expect(result.elements).toHaveLength(
      result.nodeIds.length + result.edgeIds.length,
    );
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

    expect(result.nodeIds.length).toBeGreaterThan(2);
    expect(result.nodeIds).toHaveLength(model.nodeIndex.size);
    for (const edgeId of result.edgeIds) {
      const edge = model.edgeIndex.get(edgeId)!;
      expect(nodeSet.has(edge.source)).toBe(true);
      expect(nodeSet.has(edge.target)).toBe(true);
    }
  });
});
