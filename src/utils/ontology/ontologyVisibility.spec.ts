import { describe, expect, it } from "vitest";
import type { OntologyNodeData } from "../../services/ontology/types";
import type { VisibilityState } from "../../services/ontology/visibilityTypes";
import { isOntologyElementVisible } from "./ontologyVisibility";

const classNode: OntologyNodeData = {
  id: "node:loan",
  elementType: "node",
  nodeType: "CLASS",
  type: "CLASS",
  scope: "internal",
  namespace: "loan",
  ontologyGroup: "Loans",
  label: "Commercial loan",
  technicalName: "loan:CommercialLoan",
  parents: [],
  rules: [],
};

function visibilityState(
  overrides: Partial<VisibilityState> = {},
): VisibilityState {
  return {
    showNodes: true,
    showEdges: true,
    showProperties: false,
    showParentRelations: true,
    enabledNodeTypes: new Set(["CLASS", "EXTERNAL", "PROPERTY"]),
    enabledEdgeTypes: new Set([
      "ONTOLOGY_RELATIONSHIP",
      "SUBCLASS_OF",
      "HAS_PROPERTY",
    ]),
    enabledNamespaces: new Set(["loan"]),
    enabledOntologyGroups: new Set(["Loans"]),
    enabledScopes: new Set(["internal", "external"]),
    label: "",
    technicalName: "",
    domain: "",
    range: "",
    manuallyHiddenIds: new Set(),
    isolatedIds: null,
    revealedIds: new Set(),
    ...overrides,
  };
}

describe("isOntologyElementVisible", () => {
  it("applies type, namespace and text filters", () => {
    expect(
      isOntologyElementVisible(
        classNode,
        visibilityState({ label: "commercial", technicalName: "loan:" }),
      ),
    ).toBe(true);
    expect(
      isOntologyElementVisible(classNode, visibilityState({ label: "mortgage" })),
    ).toBe(false);
  });

  it("allows search reveal to override filters", () => {
    expect(
      isOntologyElementVisible(
        classNode,
        visibilityState({
          showNodes: false,
          revealedIds: new Set([classNode.id]),
        }),
      ),
    ).toBe(true);
  });

  it("keeps manual hide authoritative over a search reveal", () => {
    expect(
      isOntologyElementVisible(
        classNode,
        visibilityState({
          revealedIds: new Set([classNode.id]),
          manuallyHiddenIds: new Set([classNode.id]),
        }),
      ),
    ).toBe(false);
  });

  it("hides property nodes until property mode is enabled", () => {
    const propertyNode: OntologyNodeData = {
      ...classNode,
      id: "node:property",
      nodeType: "PROPERTY",
      type: "PROPERTY",
    };
    expect(isOntologyElementVisible(propertyNode, visibilityState())).toBe(false);
    expect(
      isOntologyElementVisible(
        propertyNode,
        visibilityState({ showProperties: true }),
      ),
    ).toBe(true);
  });
});
