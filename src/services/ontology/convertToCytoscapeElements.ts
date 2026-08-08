import type { ElementDefinition } from "cytoscape";
import type {
  CytoscapeGraphModel,
  OntologyClass,
  OntologyDocument,
  OntologyEdgeData,
  OntologyEdgeType,
  OntologyEntityMetadata,
  OntologyNodeData,
  OntologyNodeType,
  OntologyProperty,
  OntologyScope,
} from "./types";

const EMPTY_LABEL = "Unnamed concept";

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function primaryIdentifier(entity: OntologyEntityMetadata): string {
  return (
    clean(entity.iri) ||
    clean(entity.technicalName) ||
    clean(entity.localName) ||
    clean(entity.name) ||
    EMPTY_LABEL
  );
}

function displayLabel(entity: OntologyEntityMetadata): string {
  return (
    clean(entity.label) ||
    clean(entity.name) ||
    clean(entity.localName) ||
    clean(entity.technicalName) ||
    EMPTY_LABEL
  );
}

function normalizeAlias(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function namespaceOf(entity: OntologyEntityMetadata): string {
  const technicalName = clean(entity.technicalName);

  if (technicalName.includes(":")) {
    return technicalName.split(":", 1)[0];
  }

  const iri = clean(entity.iri);

  if (iri.includes("/")) {
    const parts = iri.split("/").filter(Boolean);
    return parts.at(-2) ?? parts.at(-1) ?? "unknown";
  }

  return "unknown";
}

function ontologyGroup(document: OntologyDocument): string {
  const base = clean(document.ontologyBase);
  const parts = base.split("/").filter(Boolean);
  return parts.at(-1) ?? "ontology";
}

function createUniqueId(base: string, usedIds: Set<string>): string {
  let id = base;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${base}::${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function aliasesFor(entity: OntologyEntityMetadata): string[] {
  return [
    entity.name,
    entity.label,
    entity.localName,
    entity.technicalName,
    entity.iri,
  ]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeAlias)
    .filter(Boolean);
}

function addFacet<T extends string>(facets: Set<T>, value: T): void {
  facets.add(value);
}

export function convertToCytoscapeElements(
  document: OntologyDocument,
): CytoscapeGraphModel {
  const elements: ElementDefinition[] = [];
  const nodeIndex = new Map<string, OntologyNodeData>();
  const edgeIndex = new Map<string, OntologyEdgeData>();
  const propertiesByNodeId = new Map<string, OntologyProperty[]>();
  const classIds = new Map<OntologyClass, string>();
  const aliasIndex = new Map<string, string>();
  const usedIds = new Set<string>();
  const externalReferences = new Set<string>();
  const nodeTypes = new Set<OntologyNodeType>();
  const edgeTypes = new Set<OntologyEdgeType>();
  const namespaces = new Set<string>();
  const ontologyGroups = new Set<string>();
  const scopes = new Set<OntologyScope>();
  const group = ontologyGroup(document);
  const unresolvedRelationships = [];
  const unassignedProperties: OntologyProperty[] = [];

  addFacet(ontologyGroups, group);

  function addNode(data: OntologyNodeData, classes?: string): string {
    elements.push({ data, classes });
    nodeIndex.set(data.id, data);
    addFacet(nodeTypes, data.nodeType);
    addFacet(namespaces, data.namespace);
    addFacet(ontologyGroups, data.ontologyGroup);
    addFacet(scopes, data.scope);
    return data.id;
  }

  function addEdge(data: OntologyEdgeData, classes?: string): void {
    elements.push({ data, classes });
    edgeIndex.set(data.id, data);
    addFacet(edgeTypes, data.edgeType);
    addFacet(ontologyGroups, data.ontologyGroup);
  }

  for (const ontologyClass of document.classes) {
    const id = createUniqueId(
      `node:class:${primaryIdentifier(ontologyClass)}`,
      usedIds,
    );
    const data: OntologyNodeData = {
      ...ontologyClass,
      id,
      elementType: "node",
      nodeType: "CLASS",
      type: "CLASS",
      scope: "internal",
      namespace: namespaceOf(ontologyClass),
      ontologyGroup: group,
      label: displayLabel(ontologyClass),
      parents: ontologyClass.parents,
      rules: ontologyClass.rules,
    };

    addNode(data, "internal-node");
    classIds.set(ontologyClass, id);

    for (const alias of aliasesFor(ontologyClass)) {
      if (!aliasIndex.has(alias)) {
        aliasIndex.set(alias, id);
      }
    }
  }

  function resolveReference(reference: string): string {
    const normalizedReference = normalizeAlias(reference);
    const internalId = aliasIndex.get(normalizedReference);

    if (internalId) {
      return internalId;
    }

    const externalId = `node:external:${normalizedReference}`;

    if (nodeIndex.has(externalId)) {
      return externalId;
    }

    usedIds.add(externalId);
    externalReferences.add(reference);
    const technicalName = reference.includes(":") ? reference : undefined;
    const data: OntologyNodeData = {
      id: externalId,
      elementType: "node",
      nodeType: "EXTERNAL",
      type: "EXTERNAL",
      scope: "external",
      namespace: technicalName?.split(":", 1)[0] ?? "external",
      ontologyGroup: "external",
      name: reference,
      label: reference,
      technicalName,
      parents: [],
      rules: [],
    };

    addNode(data, "external-node");
    return externalId;
  }

  for (const ontologyClass of document.classes) {
    const source = classIds.get(ontologyClass);

    if (!source) {
      continue;
    }

    for (const [parentIndex, parent] of ontologyClass.parents.entries()) {
      const target = resolveReference(parent);
      const id = createUniqueId(
        `edge:subclass:${source}:${target}:${parentIndex}`,
        usedIds,
      );
      addEdge(
        {
          id,
          source,
          target,
          elementType: "edge",
          edgeType: "SUBCLASS_OF",
          relationshipType: "SUBCLASS_OF",
          name: "subclass of",
          label: "SUBCLASS_OF",
          technicalName: "SUBCLASS_OF",
          definition:
            "The source class is a specialization of the target class.",
          domain: [nodeIndex.get(source)?.label ?? source],
          range: [parent],
          ontologyGroup: group,
        },
        "parent-relation subclass-edge",
      );
    }
  }

  for (const [relationshipIndex, relationship] of document.edges.entries()) {
    if (relationship.domain.length === 0 || relationship.range.length === 0) {
      unresolvedRelationships.push(relationship);
      continue;
    }

    for (const [domainIndex, domain] of relationship.domain.entries()) {
      for (const [rangeIndex, range] of relationship.range.entries()) {
        const source = resolveReference(domain);
        const target = resolveReference(range);
        const id = createUniqueId(
          `edge:relationship:${primaryIdentifier(relationship)}:${relationshipIndex}:${domainIndex}:${rangeIndex}`,
          usedIds,
        );
        addEdge(
          {
            ...relationship,
            id,
            source,
            target,
            elementType: "edge",
            edgeType: "ONTOLOGY_RELATIONSHIP",
            relationshipType: "ONTOLOGY_RELATIONSHIP",
            label: displayLabel(relationship),
            domain: relationship.domain,
            range: relationship.range,
            ontologyGroup: group,
          },
          "ontology-edge",
        );
      }
    }
  }

  for (const [propertyIndex, property] of document.attributes.entries()) {
    const propertyId = createUniqueId(
      `node:property:${primaryIdentifier(property)}:${propertyIndex}`,
      usedIds,
    );
    const propertyData: OntologyNodeData = {
      ...property,
      id: propertyId,
      elementType: "node",
      nodeType: "PROPERTY",
      type: "PROPERTY",
      scope: "internal",
      namespace: namespaceOf(property),
      ontologyGroup: group,
      label: displayLabel(property),
      parents: [],
      rules: [],
    };

    addNode(propertyData, "property-element property-node");

    if (property.domain.length === 0) {
      unassignedProperties.push(property);
      continue;
    }

    for (const [domainIndex, domain] of property.domain.entries()) {
      const source = resolveReference(domain);
      const currentProperties = propertiesByNodeId.get(source) ?? [];
      currentProperties.push(property);
      propertiesByNodeId.set(source, currentProperties);

      const id = createUniqueId(
        `edge:property:${source}:${propertyId}:${domainIndex}`,
        usedIds,
      );
      addEdge(
        {
          ...property,
          id,
          source,
          target: propertyId,
          elementType: "edge",
          edgeType: "HAS_PROPERTY",
          relationshipType: "HAS_PROPERTY",
          label: "has property",
          domain: property.domain,
          range: property.range,
          ontologyGroup: group,
        },
        "property-element property-edge",
      );
    }
  }

  return {
    elements,
    nodeIndex,
    edgeIndex,
    propertiesByNodeId,
    diagnostics: {
      unresolvedRelationships,
      unassignedProperties,
      externalReferences: [...externalReferences].sort(),
    },
    facets: {
      nodeTypes: [...nodeTypes].sort(),
      edgeTypes: [...edgeTypes].sort(),
      namespaces: [...namespaces].sort(),
      ontologyGroups: [...ontologyGroups].sort(),
      scopes: [...scopes].sort(),
    },
  };
}
