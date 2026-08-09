import {
  getDefaultOntologyPath,
  hasOntology,
} from "./ontologyRegistry";

export const ONTOLOGY_STORAGE_KEY = "mermaid.ontology.selectedPath";

export type OntologySelectionStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function resolveStoredOntologySelection(
  storage: OntologySelectionStorage | null,
): string {
  let storedPath: string | null;
  try {
    storedPath = storage?.getItem(ONTOLOGY_STORAGE_KEY) ?? null;
  } catch {
    return getDefaultOntologyPath();
  }
  if (storedPath && hasOntology(storedPath)) {
    return storedPath;
  }

  if (storedPath) {
    clearOntologySelection(storage);
  }
  return getDefaultOntologyPath();
}

export function persistOntologySelection(
  storage: OntologySelectionStorage | null,
  path: string,
): void {
  try {
    storage?.setItem(ONTOLOGY_STORAGE_KEY, path);
  } catch {
    // Storage can be unavailable in restricted browsing contexts.
  }
}

export function clearOntologySelection(
  storage: OntologySelectionStorage | null,
): void {
  try {
    storage?.removeItem(ONTOLOGY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browsing contexts.
  }
}

export type LatestRequestGuard = {
  begin: () => number;
  isLatest: (requestId: number) => boolean;
};

export function createLatestRequestGuard(): LatestRequestGuard {
  let latestRequestId = 0;
  return {
    begin: () => {
      latestRequestId += 1;
      return latestRequestId;
    },
    isLatest: (requestId) => requestId === latestRequestId,
  };
}
