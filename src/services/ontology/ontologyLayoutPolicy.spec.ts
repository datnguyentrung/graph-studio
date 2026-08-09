import { describe, expect, it } from "vitest";
import {
  canRunOntologyLayout,
  chooseAutomaticOntologyLayout,
} from "./ontologyLayoutPolicy";

describe("ontology layout policy", () => {
  it("uses CoSE as the default layout for multi-node graphs", () => {
    expect(
      chooseAutomaticOntologyLayout([
        { data: { id: "root" } },
        { data: { id: "child" } },
        {
          data: {
            id: "edge",
            source: "child",
            target: "root",
            edgeType: "SUBCLASS_OF",
          },
        },
      ]),
    ).toBe("cose");
  });

  it("falls back to grid for empty and single-node views", () => {
    expect(chooseAutomaticOntologyLayout([])).toBe("grid");
    expect(
      chooseAutomaticOntologyLayout([{ data: { id: "only-node" } }]),
    ).toBe("grid");
  });

  it("does not hard-block CoSE by node count", () => {
    expect(canRunOntologyLayout("cose", 10_000)).toBe(true);
    expect(canRunOntologyLayout("breadthfirst", 10_000)).toBe(true);
  });
});
