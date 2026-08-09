import type { ElementDefinition } from "cytoscape";
import { isOntologyElementVisible } from "../../utils/ontology/ontologyVisibility";
import type {
  CytoscapeGraphModel,
  OntologyEdgeData,
} from "./types";
import type { VisibilityState } from "./visibilityTypes";

export const ONTOLOGY_GRAPH_BUDGET = {
  maxNodes: 350,
  maxEdges: 700,
  overviewDepth: 2,
  focusDepth: 1,
} as const;

export type GraphViewState =
  | { mode: "full" }
  | { mode: "overview"; depth: number }
  | { mode: "focus"; seedNodeIds: string[]; depth: number };

export type GraphProjectionResult = {
  elements: ElementDefinition[];
  nodeIds: string[];
  edgeIds: string[];
  indexedNodeCount: number;
  indexedEdgeCount: number;
  candidateNodeCount: number;
  frontierCount: number;
  truncated: boolean;
};

const edgePriority: Record<OntologyEdgeData["edgeType"], number> = {
  SUBCLASS_OF: 0,
  ONTOLOGY_RELATIONSHIP: 1,
  HAS_PROPERTY: 2,
};

function compareNode(
  model: CytoscapeGraphModel,
  leftId: string,
  rightId: string,
): number {
  const left = model.nodeIndex.get(leftId);
  const right = model.nodeIndex.get(rightId);
  return (
    (left?.label ?? leftId).localeCompare(right?.label ?? rightId) ||
    leftId.localeCompare(rightId)
  );
}

function resolveSeedNodeIds(
  model: CytoscapeGraphModel,
  elementIds: readonly string[],
): string[] {
  const nodeIds = new Set<string>();
  for (const id of elementIds) {
    if (model.nodeIndex.has(id)) {
      nodeIds.add(id);
      continue;
    }
    const edge = model.edgeIndex.get(id);
    if (edge) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }
  return [...nodeIds].sort((left, right) => compareNode(model, left, right));
}

function fallbackRootIds(model: CytoscapeGraphModel): string[] {
  return [...model.nodeIndex.values()]
    .filter((node) => node.nodeType === "CLASS" && node.scope === "internal")
    .sort(
      (left, right) =>
        left.label.localeCompare(right.label) || left.id.localeCompare(right.id),
    )
    .slice(0, 100)
    .map((node) => node.id);
}

function collectOverviewNodeIds(
  model: CytoscapeGraphModel,
  depth: number,
): string[] {
  const roots = model.rootNodeIds.length > 0
    ? model.rootNodeIds
    : fallbackRootIds(model);
  const visited = new Set(roots);
  let frontier = [...roots];

  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const nodeId of frontier) {
      for (const childId of model.subclassChildrenByNodeId.get(nodeId) ?? []) {
        if (!visited.has(childId)) {
          visited.add(childId);
          next.add(childId);
        }
      }
    }
    frontier = [...next].sort((left, right) => compareNode(model, left, right));
  }

  return [...visited].sort((left, right) => compareNode(model, left, right));
}

export function getOntologyNeighborhoodIds(
  model: CytoscapeGraphModel,
  elementIds: readonly string[],
  depth: number = ONTOLOGY_GRAPH_BUDGET.focusDepth,
): { nodeIds: string[]; edgeIds: string[] } {
  const seeds = resolveSeedNodeIds(model, elementIds);
  const nodeIds = new Set(seeds);
  const edgeIds = new Set<string>();
  let frontier = seeds;

  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const nodeId of frontier) {
      const adjacency = model.adjacencyByNodeId.get(nodeId);
      for (const edgeId of adjacency?.edgeIds ?? []) edgeIds.add(edgeId);
      for (const neighborId of adjacency?.nodeIds ?? []) {
        if (!nodeIds.has(neighborId)) {
          nodeIds.add(neighborId);
          next.add(neighborId);
        }
      }
    }
    frontier = [...next].sort((left, right) => compareNode(model, left, right));
  }

  for (const edge of model.edgeIndex.values()) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      edgeIds.add(edge.id);
    }
  }

  return {
    nodeIds: [...nodeIds].sort((left, right) => compareNode(model, left, right)),
    edgeIds: [...edgeIds].sort(),
  };
}

function includeVisibleProperties(
  model: CytoscapeGraphModel,
  nodeIds: string[],
  visibility: VisibilityState,
): string[] {
  if (!visibility.showProperties) return nodeIds;
  const result = new Set(nodeIds);
  for (const nodeId of nodeIds) {
    for (const edgeId of model.adjacencyByNodeId.get(nodeId)?.edgeIds ?? []) {
      const edge = model.edgeIndex.get(edgeId);
      if (edge?.edgeType !== "HAS_PROPERTY" || edge.source !== nodeId) continue;
      const propertyNode = model.nodeIndex.get(edge.target);
      if (propertyNode && isOntologyElementVisible(propertyNode, visibility)) {
        result.add(propertyNode.id);
      }
    }
  }
  return [...result].sort((left, right) => compareNode(model, left, right));
}

export function projectOntologyGraph(
  model: CytoscapeGraphModel,
  view: GraphViewState,
  visibility: VisibilityState,
): GraphProjectionResult {
  const candidateNodeIds = view.mode === "full"
    ? [...model.nodeIndex.keys()].sort((left, right) => compareNode(model, left, right))
    : view.mode === "overview"
      ? collectOverviewNodeIds(model, Math.max(0, view.depth))
      : getOntologyNeighborhoodIds(
          model,
          view.seedNodeIds,
          Math.max(0, view.depth),
        ).nodeIds;
  const withProperties = includeVisibleProperties(
    model,
    candidateNodeIds,
    visibility,
  );
  const visibleNodeIds = withProperties.filter((id) => {
    const node = model.nodeIndex.get(id);
    return node ? isOntologyElementVisible(node, visibility) : false;
  });
  const nodeIds = view.mode === "full"
    ? visibleNodeIds
    : visibleNodeIds.slice(0, ONTOLOGY_GRAPH_BUDGET.maxNodes);
  const nodeSet = new Set(nodeIds);
  const eligibleEdges = [...model.edgeIndex.values()]
    .filter(
      (edge) =>
        nodeSet.has(edge.source) &&
        nodeSet.has(edge.target) &&
        isOntologyElementVisible(edge, visibility),
    )
    .sort(
      (left, right) =>
        edgePriority[left.edgeType] - edgePriority[right.edgeType] ||
        left.id.localeCompare(right.id),
    );
  const edgeIds = (view.mode === "full"
    ? eligibleEdges
    : eligibleEdges.slice(0, ONTOLOGY_GRAPH_BUDGET.maxEdges))
    .map((edge) => edge.id);
  const elements = [...nodeIds, ...edgeIds]
    .map((id) => model.elementIndex.get(id))
    .filter((element): element is ElementDefinition => Boolean(element));
  const frontierCount = Math.max(0, visibleNodeIds.length - nodeIds.length);

  return {
    elements,
    nodeIds,
    edgeIds,
    indexedNodeCount: model.nodeIndex.size,
    indexedEdgeCount: model.edgeIndex.size,
    candidateNodeCount: visibleNodeIds.length,
    frontierCount,
    truncated:
      visibleNodeIds.length > nodeIds.length || eligibleEdges.length > edgeIds.length,
  };
}

export function createDefaultGraphView(): GraphViewState {
  return { mode: "full" };
}

export function toFocusView(
  model: CytoscapeGraphModel,
  elementIds: readonly string[],
  depth: number = ONTOLOGY_GRAPH_BUDGET.focusDepth,
): GraphViewState {
  return {
    mode: "focus",
    seedNodeIds: resolveSeedNodeIds(model, elementIds),
    depth,
  };
}
