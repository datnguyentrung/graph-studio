import type { ElementDefinition } from "cytoscape";
import { isOntologyElementVisible } from "../../utils/ontology/ontologyVisibility";
import type {
  CytoscapeGraphModel,
  OntologyEdgeData,
  OntologyNodeData,
} from "./types";
import type { VisibilityState } from "./visibilityTypes";

export const ONTOLOGY_GRAPH_BUDGET = {
  maxNodes: 600,
  maxEdges: 900,
  overviewDepth: 2,
  focusDepth: 1,
} as const;

export const ONTOLOGY_PROGRESSIVE_THRESHOLD = {
  maxFullNodes: 1_500,
  maxFullElements: 5_000,
} as const;

export type OntologyRenderingStrategy = "full" | "progressive";

export type GraphViewState =
  | { mode: "full" }
  | { mode: "overview" }
  | {
      mode: "hierarchy";
      expandedDomainIds: string[];
      expandedModuleIds: string[];
      expandedClassIds: string[];
      relationshipSeedNodeIds: string[];
    }
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

const SYNTHETIC_ROOT_ID = "view:ontology-root:FIBO";
const SYNTHETIC_EDGE_TYPE = "SUBCLASS_OF" satisfies OntologyEdgeData["edgeType"];

const edgePriority: Record<OntologyEdgeData["edgeType"], number> = {
  SUBCLASS_OF: 0,
  ONTOLOGY_RELATIONSHIP: 1,
  HAS_PROPERTY: 2,
};

function compareLabel(leftLabel: string, leftId: string, rightLabel: string, rightId: string) {
  return leftLabel.localeCompare(rightLabel) || leftId.localeCompare(rightId);
}

function compareNode(
  model: CytoscapeGraphModel,
  leftId: string,
  rightId: string,
): number {
  const left = model.nodeIndex.get(leftId);
  const right = model.nodeIndex.get(rightId);
  return compareLabel(left?.label ?? leftId, leftId, right?.label ?? rightId, rightId);
}

function domainNodeId(domain: string): string {
  return `view:domain:${domain}`;
}

function moduleNodeId(moduleKey: string): string {
  return `view:module:${moduleKey}`;
}

function syntheticEdgeId(source: string, target: string): string {
  return `view:edge:${source}:${target}`;
}

function moduleKey(domain: string, moduleName: string): string {
  return `${domain}/${moduleName}`;
}

function createSyntheticNode(
  id: string,
  label: string,
  classes: string,
  counts?: string,
): ElementDefinition {
  return {
    data: {
      id,
      elementType: "node",
      nodeType: "CLASS",
      type: "CLASS",
      scope: "internal",
      namespace: "view",
      ontologyGroup: "view",
      label: counts ? `${label}\n${counts}` : label,
      parents: [],
      rules: [],
    } satisfies OntologyNodeData,
    classes,
  };
}

function createSyntheticEdge(source: string, target: string): ElementDefinition {
  return {
    data: {
      id: syntheticEdgeId(source, target),
      source,
      target,
      elementType: "edge",
      edgeType: SYNTHETIC_EDGE_TYPE,
      relationshipType: SYNTHETIC_EDGE_TYPE,
      label: "",
      domain: [],
      range: [],
      ontologyGroup: "view",
    } satisfies OntologyEdgeData,
    classes: "view-edge subclass-edge",
  };
}

function sortIds(ids: Iterable<string>): string[] {
  return [...ids].sort();
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

function visibleRealNodeIds(
  model: CytoscapeGraphModel,
  ids: Iterable<string>,
  visibility: VisibilityState,
): string[] {
  return [...ids]
    .filter((id) => {
      const node = model.nodeIndex.get(id);
      return node ? isOntologyElementVisible(node, visibility) : false;
    })
    .sort((left, right) => compareNode(model, left, right));
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

function getFullCandidateNodeIds(
  model: CytoscapeGraphModel,
  visibility: VisibilityState,
): string[] {
  return visibleRealNodeIds(model, model.nodeIndex.keys(), visibility);
}

export function chooseOntologyRenderingStrategy(
  model: CytoscapeGraphModel,
): OntologyRenderingStrategy {
  return model.nodeIndex.size > ONTOLOGY_PROGRESSIVE_THRESHOLD.maxFullNodes ||
    model.nodeIndex.size + model.edgeIndex.size > ONTOLOGY_PROGRESSIVE_THRESHOLD.maxFullElements
    ? "progressive"
    : "full";
}

function modulesForDomain(model: CytoscapeGraphModel, domain: string): string[] {
  return sortIds(model.nodeIdsByModule.keys()).filter((key) =>
    key.startsWith(`${domain}/`),
  );
}

function realClassIdsForModule(model: CytoscapeGraphModel, moduleId: string): string[] {
  return (model.nodeIdsByModule.get(moduleId) ?? [])
    .filter((nodeId) => {
      const node = model.nodeIndex.get(nodeId);
      return node?.nodeType === "CLASS" && node.scope === "internal";
    })
    .sort((left, right) => compareNode(model, left, right));
}

function moduleRootClassIds(model: CytoscapeGraphModel, moduleId: string): string[] {
  const moduleNodeSet = new Set(realClassIdsForModule(model, moduleId));
  const roots = [...moduleNodeSet].filter((nodeId) => {
    const parents = model.subclassParentsByNodeId.get(nodeId) ?? [];
    return !parents.some((parentId) => moduleNodeSet.has(parentId));
  });
  return (roots.length > 0 ? roots : [...moduleNodeSet])
    .sort((left, right) => compareNode(model, left, right));
}

function subclassChildrenInSameModule(
  model: CytoscapeGraphModel,
  nodeId: string,
): string[] {
  const location = model.locationByNodeId.get(nodeId);
  if (!location) return [];
  const currentModuleKey = moduleKey(location.domain, location.module);
  return (model.subclassChildrenByNodeId.get(nodeId) ?? [])
    .filter((childId) => {
      const childLocation = model.locationByNodeId.get(childId);
      return childLocation &&
        moduleKey(childLocation.domain, childLocation.module) === currentModuleKey;
    })
    .sort((left, right) => compareNode(model, left, right));
}

function collectExpandedClassIds(
  model: CytoscapeGraphModel,
  expandedModuleIds: Set<string>,
  expandedClassIds: Set<string>,
): string[] {
  const result = new Set<string>();
  for (const moduleId of expandedModuleIds) {
    for (const rootId of moduleRootClassIds(model, moduleId)) {
      result.add(rootId);
    }
  }
  for (const classId of expandedClassIds) {
    result.add(classId);
    for (const childId of subclassChildrenInSameModule(model, classId)) {
      result.add(childId);
    }
  }
  return [...result].sort((left, right) => compareNode(model, left, right));
}

function subclassDescendantsInSameModule(
  model: CytoscapeGraphModel,
  nodeId: string,
): Set<string> {
  const descendants = new Set<string>();
  const queue = [...subclassChildrenInSameModule(model, nodeId)];
  while (queue.length > 0) {
    const childId = queue.shift()!;
    if (descendants.has(childId)) continue;
    descendants.add(childId);
    queue.push(...subclassChildrenInSameModule(model, childId));
  }
  return descendants;
}

function collectRelationshipSubset(
  model: CytoscapeGraphModel,
  seedNodeIds: readonly string[],
  visibility: VisibilityState,
): { nodeIds: string[]; edgeIds: string[] } {
  const neighborhood = getOntologyNeighborhoodIds(model, seedNodeIds, 1);
  const nodeIds = visibleRealNodeIds(model, neighborhood.nodeIds, visibility);
  const nodeSet = new Set(nodeIds);
  const edgeIds = neighborhood.edgeIds.filter((edgeId) => {
    const edge = model.edgeIndex.get(edgeId);
    return edge &&
      edge.edgeType !== "HAS_PROPERTY" &&
      nodeSet.has(edge.source) &&
      nodeSet.has(edge.target) &&
      isOntologyElementVisible(edge, visibility);
  });
  return { nodeIds, edgeIds: sortIds(edgeIds) };
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
    edgeIds: sortIds(edgeIds),
  };
}

function projectFullGraph(
  model: CytoscapeGraphModel,
  view: GraphViewState,
  visibility: VisibilityState,
): GraphProjectionResult {
  const candidateNodeIds = view.mode === "full"
    ? getFullCandidateNodeIds(model, visibility)
    : getOntologyNeighborhoodIds(
        model,
        view.mode === "focus" ? view.seedNodeIds : [],
        view.mode === "focus" ? Math.max(0, view.depth) : 0,
      ).nodeIds;
  const withProperties = includeVisibleProperties(model, candidateNodeIds, visibility);
  const nodeIds = visibleRealNodeIds(model, withProperties, visibility);
  const nodeSet = new Set(nodeIds);
  const edgeIds = [...model.edgeIndex.values()]
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
    )
    .map((edge) => edge.id);
  const elements = [...nodeIds, ...edgeIds]
    .map((id) => model.elementIndex.get(id))
    .filter((element): element is ElementDefinition => Boolean(element));

  return {
    elements,
    nodeIds,
    edgeIds,
    indexedNodeCount: model.nodeIndex.size,
    indexedEdgeCount: model.edgeIndex.size,
    candidateNodeCount: nodeIds.length,
    frontierCount: 0,
    truncated: false,
  };
}

function projectProgressiveGraph(
  model: CytoscapeGraphModel,
  view: Extract<GraphViewState, { mode: "overview" | "hierarchy" }>,
  visibility: VisibilityState,
): GraphProjectionResult {
  const expandedDomainIds = view.mode === "hierarchy"
    ? new Set(view.expandedDomainIds)
    : new Set<string>();
  const expandedModuleIds = view.mode === "hierarchy"
    ? new Set(view.expandedModuleIds)
    : new Set<string>();
  const expandedClassIds = view.mode === "hierarchy"
    ? new Set(view.expandedClassIds)
    : new Set<string>();
  const relationshipSeedNodeIds = view.mode === "hierarchy"
    ? view.relationshipSeedNodeIds
    : [];
  const domains = sortIds(model.nodeIdsByDomain.keys());
  const syntheticElements = new Map<string, ElementDefinition>();
  const syntheticEdges: ElementDefinition[] = [];
  const realNodeIds = new Set<string>();
  const explicitEdgeIds = new Set<string>();

  syntheticElements.set(
    SYNTHETIC_ROOT_ID,
    createSyntheticNode(SYNTHETIC_ROOT_ID, "FIBO", "view-node root-node", `${domains.length} domains`),
  );

  for (const domain of domains) {
    const domainId = domainNodeId(domain);
    const modules = modulesForDomain(model, domain);
    syntheticElements.set(
      domainId,
      createSyntheticNode(
        domainId,
        domain,
        "view-node domain-node",
        `${modules.length} modules`,
      ),
    );
    syntheticEdges.push(createSyntheticEdge(SYNTHETIC_ROOT_ID, domainId));

    if (!expandedDomainIds.has(domain)) continue;
    for (const moduleId of modules) {
      const moduleName = moduleId.split("/").at(-1) ?? moduleId;
      const id = moduleNodeId(moduleId);
      syntheticElements.set(
        id,
        createSyntheticNode(
          id,
          moduleName,
          "view-node module-node",
          `${realClassIdsForModule(model, moduleId).length} classes`,
        ),
      );
      syntheticEdges.push(createSyntheticEdge(domainId, id));
    }
  }

  for (const nodeId of collectExpandedClassIds(model, expandedModuleIds, expandedClassIds)) {
    realNodeIds.add(nodeId);
  }

  for (const expandedModuleId of expandedModuleIds) {
    const syntheticModuleId = moduleNodeId(expandedModuleId);
    for (const rootId of moduleRootClassIds(model, expandedModuleId)) {
      syntheticEdges.push(createSyntheticEdge(syntheticModuleId, rootId));
    }
  }

  if (relationshipSeedNodeIds.length > 0) {
    const relationshipSubset = collectRelationshipSubset(
      model,
      relationshipSeedNodeIds,
      visibility,
    );
    for (const nodeId of relationshipSubset.nodeIds) realNodeIds.add(nodeId);
    for (const edgeId of relationshipSubset.edgeIds) explicitEdgeIds.add(edgeId);
  }

  const visibleRealNodeIdsList = visibleRealNodeIds(model, realNodeIds, visibility);
  const visibleRealWithProperties = includeVisibleProperties(
    model,
    visibleRealNodeIdsList,
    visibility,
  );
  const realNodeIdsList = visibleRealNodeIds(model, visibleRealWithProperties, visibility);
  const orderedNodeIds = [
    ...sortIds(syntheticElements.keys()),
    ...realNodeIdsList,
  ].slice(0, ONTOLOGY_GRAPH_BUDGET.maxNodes);
  const nodeSet = new Set(orderedNodeIds);
  const hierarchyEdgeIds = [...model.edgeIndex.values()]
    .filter(
      (edge) =>
        edge.edgeType === "SUBCLASS_OF" &&
        nodeSet.has(edge.source) &&
        nodeSet.has(edge.target) &&
        isOntologyElementVisible(edge, visibility),
    )
    .map((edge) => edge.id);
  const propertyEdgeIds = visibility.showProperties
    ? [...model.edgeIndex.values()]
        .filter(
          (edge) =>
            edge.edgeType === "HAS_PROPERTY" &&
            nodeSet.has(edge.source) &&
            nodeSet.has(edge.target) &&
            isOntologyElementVisible(edge, visibility),
        )
        .map((edge) => edge.id)
    : [];
  const relationshipEdgeIds = [...model.edgeIndex.values()]
    .filter(
      (edge) =>
        edge.edgeType === "ONTOLOGY_RELATIONSHIP" &&
        nodeSet.has(edge.source) &&
        nodeSet.has(edge.target) &&
        isOntologyElementVisible(edge, visibility),
    )
    .map((edge) => edge.id);
  const realEdgeIds = sortIds(new Set([
    ...hierarchyEdgeIds,
    ...relationshipEdgeIds,
    ...propertyEdgeIds,
    ...explicitEdgeIds,
  ])).filter((edgeId) => {
    const edge = model.edgeIndex.get(edgeId);
    return edge && nodeSet.has(edge.source) && nodeSet.has(edge.target);
  });
  const visibleSyntheticEdges = syntheticEdges.filter(
    (edge) => nodeSet.has(String(edge.data.source)) && nodeSet.has(String(edge.data.target)),
  );
  const orderedEdgeIds = [
    ...visibleSyntheticEdges.map((edge) => String(edge.data.id)),
    ...realEdgeIds,
  ].slice(0, ONTOLOGY_GRAPH_BUDGET.maxEdges);
  const syntheticEdgeById = new Map(
    visibleSyntheticEdges.map((edge) => [String(edge.data.id), edge]),
  );
  const elements = [
    ...orderedNodeIds.map((id) => syntheticElements.get(id) ?? model.elementIndex.get(id)),
    ...orderedEdgeIds.map((id) => syntheticEdgeById.get(id) ?? model.elementIndex.get(id)),
  ].filter((element): element is ElementDefinition => Boolean(element));
  const candidateNodeCount = syntheticElements.size + realNodeIdsList.length;
  const candidateEdgeCount = visibleSyntheticEdges.length + realEdgeIds.length;

  return {
    elements,
    nodeIds: orderedNodeIds,
    edgeIds: orderedEdgeIds,
    indexedNodeCount: model.nodeIndex.size,
    indexedEdgeCount: model.edgeIndex.size,
    candidateNodeCount,
    frontierCount: Math.max(0, candidateNodeCount - orderedNodeIds.length),
    truncated:
      candidateNodeCount > orderedNodeIds.length ||
      candidateEdgeCount > orderedEdgeIds.length,
  };
}

export function projectOntologyGraph(
  model: CytoscapeGraphModel,
  view: GraphViewState,
  visibility: VisibilityState,
): GraphProjectionResult {
  if (view.mode === "overview" || view.mode === "hierarchy") {
    return projectProgressiveGraph(model, view, visibility);
  }
  return projectFullGraph(model, view, visibility);
}

export function createDefaultGraphView(
  strategy: OntologyRenderingStrategy = "full",
): GraphViewState {
  return strategy === "progressive" ? { mode: "overview" } : { mode: "full" };
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

export function toHierarchyViewForNode(
  model: CytoscapeGraphModel,
  nodeId: string,
): GraphViewState {
  const location = model.locationByNodeId.get(nodeId);
  if (!location) return { mode: "overview" };
  const expandedClassIds = new Set<string>();
  const queue = [...(model.subclassParentsByNodeId.get(nodeId) ?? [])];
  const visited = new Set<string>();
  const currentModuleKey = moduleKey(location.domain, location.module);

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);
    const parentLocation = model.locationByNodeId.get(parentId);
    if (parentLocation && moduleKey(parentLocation.domain, parentLocation.module) === currentModuleKey) {
      expandedClassIds.add(parentId);
      queue.push(...(model.subclassParentsByNodeId.get(parentId) ?? []));
    }
  }

  return {
    mode: "hierarchy",
    expandedDomainIds: [location.domain],
    expandedModuleIds: [currentModuleKey],
    expandedClassIds: [...expandedClassIds].sort((left, right) =>
      compareNode(model, left, right),
    ),
    relationshipSeedNodeIds: [],
  };
}

export function toggleHierarchyExpansion(
  model: CytoscapeGraphModel,
  current: GraphViewState,
  nodeId: string | undefined,
): GraphViewState {
  const base = current.mode === "hierarchy"
    ? current
    : {
        mode: "hierarchy" as const,
        expandedDomainIds: [],
        expandedModuleIds: [],
        expandedClassIds: [],
        relationshipSeedNodeIds: [],
      };

  if (!nodeId) return base;
  const nextDomains = new Set(base.expandedDomainIds);
  const nextModules = new Set(base.expandedModuleIds);
  const nextClasses = new Set(base.expandedClassIds);
  const nextRelationshipSeeds = new Set(base.relationshipSeedNodeIds);

  if (nodeId.startsWith("view:domain:")) {
    const domain = nodeId.slice("view:domain:".length);
    if (nextDomains.has(domain)) {
      nextDomains.delete(domain);
      for (const key of modulesForDomain(model, domain)) nextModules.delete(key);
      for (const classId of nextClasses) {
        if (model.locationByNodeId.get(classId)?.domain === domain) nextClasses.delete(classId);
      }
      for (const seedId of nextRelationshipSeeds) {
        if (model.locationByNodeId.get(seedId)?.domain === domain) nextRelationshipSeeds.delete(seedId);
      }
    } else {
      nextDomains.add(domain);
    }
  } else if (nodeId.startsWith("view:module:")) {
    const key = nodeId.slice("view:module:".length);
    const [domain] = key.split("/");
    nextDomains.add(domain);
    if (nextModules.has(key)) {
      nextModules.delete(key);
      for (const classId of nextClasses) {
        const location = model.locationByNodeId.get(classId);
        if (location && moduleKey(location.domain, location.module) === key) nextClasses.delete(classId);
      }
      for (const seedId of nextRelationshipSeeds) {
        const location = model.locationByNodeId.get(seedId);
        if (location && moduleKey(location.domain, location.module) === key) nextRelationshipSeeds.delete(seedId);
      }
    } else {
      nextModules.add(key);
    }
  } else if (model.nodeIndex.get(nodeId)?.nodeType === "CLASS") {
    const location = model.locationByNodeId.get(nodeId);
    if (location) {
      nextDomains.add(location.domain);
      nextModules.add(moduleKey(location.domain, location.module));
    }
    if (nextClasses.has(nodeId)) {
      nextClasses.delete(nodeId);
      for (const descendantId of subclassDescendantsInSameModule(model, nodeId)) {
        nextClasses.delete(descendantId);
        nextRelationshipSeeds.delete(descendantId);
      }
    } else {
      nextClasses.add(nodeId);
    }
  }

  return {
    mode: "hierarchy",
    expandedDomainIds: sortIds(nextDomains),
    expandedModuleIds: sortIds(nextModules),
    expandedClassIds: [...nextClasses].sort((left, right) =>
      compareNode(model, left, right),
    ),
    relationshipSeedNodeIds: sortIds(nextRelationshipSeeds),
  };
}

export function isHierarchyNodeExpanded(
  view: GraphViewState,
  nodeId: string,
): boolean {
  if (view.mode !== "hierarchy") return false;
  if (nodeId.startsWith("view:domain:")) {
    return view.expandedDomainIds.includes(nodeId.slice("view:domain:".length));
  }
  if (nodeId.startsWith("view:module:")) {
    return view.expandedModuleIds.includes(nodeId.slice("view:module:".length));
  }
  return view.expandedClassIds.includes(nodeId);
}

export function setHierarchyRelationshipSeed(
  current: GraphViewState,
  seedNodeIds: readonly string[],
): GraphViewState {
  const hierarchy = current.mode === "hierarchy"
    ? current
    : {
        mode: "hierarchy" as const,
        expandedDomainIds: [],
        expandedModuleIds: [],
        expandedClassIds: [],
        relationshipSeedNodeIds: [],
      };
  return {
    ...hierarchy,
    relationshipSeedNodeIds: [...seedNodeIds].sort(),
  };
}
