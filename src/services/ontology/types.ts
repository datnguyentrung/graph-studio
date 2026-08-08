import type { ElementDefinition } from "cytoscape";

export type OntologyEntityMetadata = {
  [key: string]: unknown;
  kind?: string;
  name?: string;
  technicalName?: string;
  localName?: string;
  iri?: string;
  label?: string;
  definition?: string;
};

export type OntologyClass = OntologyEntityMetadata & {
  parents: string[];
  rules: unknown[];
};

export type OntologyRelationship = OntologyEntityMetadata & {
  domain: string[];
  range: string[];
};

export type OntologyProperty = OntologyEntityMetadata & {
  domain: string[];
  range: string[];
};

export type OntologyDocument = {
  [key: string]: unknown;
  file?: string;
  ontologyBase?: string;
  summary?: Record<string, unknown>;
  imports: string[];
  classes: OntologyClass[];
  edges: OntologyRelationship[];
  attributes: OntologyProperty[];
};

export type OntologyNodeType = "CLASS" | "EXTERNAL" | "PROPERTY";
export type OntologyScope = "internal" | "external";
export type OntologyEdgeType =
  | "ONTOLOGY_RELATIONSHIP"
  | "SUBCLASS_OF"
  | "HAS_PROPERTY";

export type OntologyNodeData = OntologyEntityMetadata & {
  id: string;
  elementType: "node";
  nodeType: OntologyNodeType;
  type: OntologyNodeType;
  scope: OntologyScope;
  namespace: string;
  ontologyGroup: string;
  label: string;
  parents: string[];
  rules: unknown[];
};

export type OntologyEdgeData = OntologyEntityMetadata & {
  id: string;
  source: string;
  target: string;
  elementType: "edge";
  edgeType: OntologyEdgeType;
  relationshipType: OntologyEdgeType;
  label: string;
  domain: string[];
  range: string[];
  ontologyGroup: string;
};

export type OntologyDiagnostics = {
  unresolvedRelationships: OntologyRelationship[];
  unassignedProperties: OntologyProperty[];
  externalReferences: string[];
};

export type OntologyFacets = {
  nodeTypes: OntologyNodeType[];
  edgeTypes: OntologyEdgeType[];
  namespaces: string[];
  ontologyGroups: string[];
  scopes: OntologyScope[];
};

export type CytoscapeGraphModel = {
  elements: ElementDefinition[];
  nodeIndex: Map<string, OntologyNodeData>;
  edgeIndex: Map<string, OntologyEdgeData>;
  propertiesByNodeId: Map<string, OntologyProperty[]>;
  diagnostics: OntologyDiagnostics;
  facets: OntologyFacets;
};
