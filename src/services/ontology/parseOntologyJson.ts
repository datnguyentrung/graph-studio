import type {
  OntologyClass,
  OntologyDocument,
  OntologyEntityMetadata,
  OntologyProperty,
  OntologyRelationship,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function metadata(value: unknown): OntologyEntityMetadata {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...value,
    kind: optionalString(value.kind),
    name: optionalString(value.name),
    technicalName: optionalString(value.technicalName),
    localName: optionalString(value.localName),
    iri: optionalString(value.iri),
    label: optionalString(value.label),
    definition: optionalString(value.definition),
  };
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function ontologyClass(value: Record<string, unknown>): OntologyClass {
  return {
    ...metadata(value),
    parents: stringArray(value.parents),
    rules: Array.isArray(value.rules) ? value.rules : [],
  };
}

function ontologyRelationship(
  value: Record<string, unknown>,
): OntologyRelationship {
  return {
    ...metadata(value),
    domain: stringArray(value.domain),
    range: stringArray(value.range),
  };
}

function ontologyProperty(value: Record<string, unknown>): OntologyProperty {
  return {
    ...metadata(value),
    domain: stringArray(value.domain),
    range: stringArray(value.range),
  };
}

export function parseOntologyJson(rawJson: string): OntologyDocument {
  const parsed: unknown = JSON.parse(rawJson);

  if (!isRecord(parsed)) {
    throw new Error("Ontology JSON must contain an object at its root.");
  }

  return {
    ...parsed,
    file: optionalString(parsed.file),
    ontologyBase: optionalString(parsed.ontologyBase),
    summary: isRecord(parsed.summary) ? parsed.summary : undefined,
    imports: stringArray(parsed.imports),
    classes: objectArray(parsed.classes).map(ontologyClass),
    edges: objectArray(parsed.edges).map(ontologyRelationship),
    attributes: objectArray(parsed.attributes).map(ontologyProperty),
  };
}
