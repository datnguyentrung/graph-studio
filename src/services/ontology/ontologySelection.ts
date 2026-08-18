import {
  getDefaultOntologyPath,
  hasOntology,
} from "./ontologyRegistry";

export const ONTOLOGY_STORAGE_KEY = "mermaid.ontology.selectedPath";
export const ONTOLOGY_SOURCE_PARAM = "source";

export type OntologySelectionStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type ResolvedOntologySelection = {
  path: string;
  sourcePath: string | null;
  invalidSourcePath: string | null;
};

function readSourceParam(search: string): string | null {
  const source = new URLSearchParams(search).get(ONTOLOGY_SOURCE_PARAM);
  const trimmedSource = source?.trim() ?? "";
  return trimmedSource || null;
}

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

export function resolveOntologySourceParam(search: string): string | null {
  const sourcePath = readSourceParam(search);
  return sourcePath && hasOntology(sourcePath) ? sourcePath : null;
}

export function resolveOntologySelection(
  storage: OntologySelectionStorage | null,
  search: string,
): ResolvedOntologySelection {
  const sourcePath = readSourceParam(search);
  if (sourcePath && hasOntology(sourcePath)) {
    return {
      path: sourcePath,
      sourcePath,
      invalidSourcePath: null,
    };
  }

  return {
    path: resolveStoredOntologySelection(storage),
    sourcePath: null,
    invalidSourcePath: sourcePath,
  };
}

export function buildOntologySourceUrl(
  pathname: string,
  search: string,
  path: string,
): string {
  const params = new URLSearchParams(search);
  params.set(ONTOLOGY_SOURCE_PARAM, path);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
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
