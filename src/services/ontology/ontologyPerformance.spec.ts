import { describe, expect, it } from "vitest";
import { convertToCytoscapeElements } from "./convertToCytoscapeElements";
import {
  chooseAutomaticOntologyLayout,
} from "./ontologyLayoutPolicy";
import {
  createDefaultGraphView,
  projectOntologyGraph,
} from "./projectOntologyGraph";
import { loadOntology } from "./ontologyRegistry";
import { createDefaultFilters } from "./visibilityTypes";

describe("aggregate ontology performance budget", () => {
  it("projects the full initial view without a long blocking task", async () => {
    const model = convertToCytoscapeElements(
      await loadOntology("all.ontology.json"),
    );
    const projectionStart = performance.now();
    const projection = projectOntologyGraph(
      model,
      createDefaultGraphView(),
      {
        ...createDefaultFilters(model.facets),
        manuallyHiddenIds: new Set(),
        isolatedIds: null,
        revealedIds: new Set(),
      },
    );
    const projectionDuration = performance.now() - projectionStart;
    const layoutName = chooseAutomaticOntologyLayout(projection.elements);

    expect(model.nodeIndex.size).toBe(3342);
    expect(model.edgeIndex.size).toBe(4929);
    expect(projection.nodeIds).toHaveLength(3342);
    expect(projection.edgeIds).toHaveLength(4929);
    expect(layoutName).toBe("cose");
    expect(projectionDuration).toBeLessThan(200);
  });
});
