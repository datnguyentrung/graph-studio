import type { OntologyNodeData } from "../../services/ontology/types";

const SEARCH_FIELDS: Array<keyof OntologyNodeData> = [
  "name",
  "label",
  "localName",
  "technicalName",
  "iri",
];

export type OntologyTextFilters = {
  label: string;
  technicalName: string;
  namespace: string;
  domain: string;
  range: string;
};

export function containsOntologyValue(value: unknown, query: string): boolean {
  if (!query) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsOntologyValue(item, query));
  }

  return typeof value === "string"
    ? value.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    : false;
}

export function matchesNodeSearch(
  node: OntologyNodeData,
  query: string,
): boolean {
  const normalizedQuery = query.trim();
  return (
    normalizedQuery.length > 0 &&
    SEARCH_FIELDS.some((field) =>
      containsOntologyValue(node[field], normalizedQuery),
    )
  );
}

export function matchesTextFilters(
  data: Record<string, unknown>,
  filters: OntologyTextFilters,
  includeEndpoints = true,
): boolean {
  return (
    containsOntologyValue(data.label, filters.label.trim()) &&
    containsOntologyValue(data.technicalName, filters.technicalName.trim()) &&
    containsOntologyValue(data.namespace, filters.namespace.trim()) &&
    (!includeEndpoints ||
      (containsOntologyValue(data.domain, filters.domain.trim()) &&
        containsOntologyValue(data.range, filters.range.trim())))
  );
}
