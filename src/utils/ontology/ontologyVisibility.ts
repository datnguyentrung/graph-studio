import type {
  OntologyEdgeData,
  OntologyNodeData,
} from "../../services/ontology/types";
import type { VisibilityState } from "../../services/ontology/visibilityTypes";
import { matchesTextFilters } from "./searchOntology";

export function isOntologyElementVisible(
  data: OntologyNodeData | OntologyEdgeData,
  state: VisibilityState,
): boolean {
  const isNode = data.elementType === "node";
  const isProperty = isNode
    ? data.nodeType === "PROPERTY"
    : data.edgeType === "HAS_PROPERTY";
  let visible: boolean;

  if (isNode) {
    visible =
      state.showNodes &&
      (!isProperty || state.showProperties) &&
      state.enabledNodeTypes.has(data.nodeType) &&
      state.enabledNamespaces.has(data.namespace) &&
      state.enabledOntologyGroups.has(data.ontologyGroup) &&
      state.enabledScopes.has(data.scope) &&
      matchesTextFilters(data, { ...state, namespace: "" }, false);
  } else {
    visible =
      state.showEdges &&
      (!isProperty || state.showProperties) &&
      (data.edgeType !== "SUBCLASS_OF" || state.showParentRelations) &&
      state.enabledEdgeTypes.has(data.edgeType) &&
      state.enabledOntologyGroups.has(data.ontologyGroup) &&
      matchesTextFilters(data, { ...state, namespace: "" });
  }

  if (state.isolatedIds && !state.isolatedIds.has(data.id)) {
    visible = false;
  }

  if (state.revealedIds.has(data.id)) {
    visible = true;
  }

  if (state.manuallyHiddenIds.has(data.id)) {
    visible = false;
  }

  return visible;
}
