import type { ElementDefinition } from "cytoscape";

export type OntologyLayoutName =
  | "cose"
  | "breadthfirst"
  | "circle"
  | "concentric"
  | "grid";

export function isOntologyEdgeDefinition(element: ElementDefinition): boolean {
  return (
    typeof element.data.source === "string" &&
    typeof element.data.target === "string"
  );
}

export function countOntologyNodes(elements: ElementDefinition[]): number {
  return elements.filter((element) => !isOntologyEdgeDefinition(element))
    .length;
}

export const spaciousCoseLayoutOptions = {
  name: "cose",
  animate: false,
  fit: false,
  padding: 160,
  idealEdgeLength: 90,
  nodeOverlap: 24,
  nodeRepulsion: 900000,
  componentSpacing: 110,
  nestingFactor: 1.3,
  gravity: 0.18,
  numIter: 2500,
  initialTemp: 1400,
  coolingFactor: 0.95,
  minTemp: 1,
} as const;

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
