import type {
  OntologyEdgeType,
  OntologyFacets,
  OntologyNodeType,
  OntologyScope,
} from "./types";

export type OntologyFilterState = {
  showNodes: boolean;
  showEdges: boolean;
  showProperties: boolean;
  showParentRelations: boolean;
  enabledNodeTypes: Set<OntologyNodeType>;
  enabledEdgeTypes: Set<OntologyEdgeType>;
  enabledScopes: Set<OntologyScope>;
  enabledNamespaces: Set<string>;
  enabledOntologyGroups: Set<string>;
  label: string;
  technicalName: string;
  domain: string;
  range: string;
};

export type VisibilityState = OntologyFilterState & {
  manuallyHiddenIds: Set<string>;
  isolatedIds: Set<string> | null;
  revealedIds: Set<string>;
};

export function createDefaultFilters(
  facets: OntologyFacets,
): OntologyFilterState {
  return {
    showNodes: true,
    showEdges: true,
    showProperties: false,
    showParentRelations: true,
    enabledNodeTypes: new Set(facets.nodeTypes),
    enabledEdgeTypes: new Set(facets.edgeTypes),
    enabledScopes: new Set(facets.scopes),
    enabledNamespaces: new Set(facets.namespaces),
    enabledOntologyGroups: new Set(facets.ontologyGroups),
    label: "",
    technicalName: "",
    domain: "",
    range: "",
  };
}
