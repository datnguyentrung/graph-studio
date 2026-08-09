import type { ElementDefinition } from "cytoscape";

export type OntologyLayoutName =
  | "cose"
  | "breadthfirst"
  | "circle"
  | "concentric"
  | "grid";

export function isOntologyEdgeDefinition(
  element: ElementDefinition,
): boolean {
  return typeof element.data.source === "string" &&
    typeof element.data.target === "string";
}

export function countOntologyNodes(elements: ElementDefinition[]): number {
  return elements.filter((element) => !isOntologyEdgeDefinition(element)).length;
}

export function chooseAutomaticOntologyLayout(
  elements: ElementDefinition[],
): OntologyLayoutName {
  return countOntologyNodes(elements) > 1 ? "cose" : "grid";
}

export function canRunOntologyLayout(
  name: OntologyLayoutName,
  nodeCount: number,
): boolean {
  void name;
  void nodeCount;
  return true;
}
