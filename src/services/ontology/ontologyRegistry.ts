import { parseOntologyJson } from "./parseOntologyJson";
import type { OntologyDocument } from "./types";

const ONTOLOGY_ROOT_PREFIX = "../../../data/ontology/";
const PREFERRED_DEFAULT_ONTOLOGY_PATH = "LOAN/all_loan.ontology.json";

const rawOntologyLoaders = import.meta.glob<string>(
  "../../../data/ontology/**/*.ontology.json",
  { query: "?raw", import: "default" },
);

const ontologyLoaders = new Map<string, () => Promise<string>>(
  Object.entries(rawOntologyLoaders).map(([modulePath, loader]) => [
    modulePath.replace(ONTOLOGY_ROOT_PREFIX, "").replaceAll("\\", "/"),
    loader,
  ]),
);

const ontologyPaths = [...ontologyLoaders.keys()].sort((left, right) =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
);

export function getOntologyPaths(): readonly string[] {
  return ontologyPaths;
}

export function hasOntology(path: string): boolean {
  return ontologyLoaders.has(path);
}

export function getDefaultOntologyPath(): string {
  const defaultPath = hasOntology(PREFERRED_DEFAULT_ONTOLOGY_PATH)
    ? PREFERRED_DEFAULT_ONTOLOGY_PATH
    : ontologyPaths[0];

  if (!defaultPath) {
    throw new Error("No ontology data source was found.");
  }

  return defaultPath;
}

export function resolveOntologyPath(storedPath: string | null): string {
  return storedPath && hasOntology(storedPath)
    ? storedPath
    : getDefaultOntologyPath();
}

export async function loadOntology(path: string): Promise<OntologyDocument> {
  const loader = ontologyLoaders.get(path);
  if (!loader) {
    throw new Error(`Ontology source was not found: ${path}`);
  }

  try {
    return parseOntologyJson(await loader());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Could not load ontology "${path}": ${message}`, {
      cause: error,
    });
  }
}
