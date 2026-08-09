import { describe, expect, it, vi } from "vitest";
import {
  ONTOLOGY_STORAGE_KEY,
  clearOntologySelection,
  createLatestRequestGuard,
  persistOntologySelection,
  resolveStoredOntologySelection,
  type OntologySelectionStorage,
} from "./ontologySelection";
import { getDefaultOntologyPath } from "./ontologyRegistry";

function storageWith(value: string | null): OntologySelectionStorage {
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

describe("ontology selection state", () => {
  it("keeps a valid stored path", () => {
    const path = "LOAN/LoansSpecific/CommercialLoans.ontology.json";
    const storage = storageWith(path);

    expect(resolveStoredOntologySelection(storage)).toBe(path);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("removes a missing stored path and falls back to the default", () => {
    const storage = storageWith("removed.ontology.json");

    expect(resolveStoredOntologySelection(storage)).toBe(
      getDefaultOntologyPath(),
    );
    expect(storage.removeItem).toHaveBeenCalledWith(ONTOLOGY_STORAGE_KEY);
  });

  it("persists and clears the selected path through the shared key", () => {
    const storage = storageWith(null);
    const path = "all.ontology.json";

    persistOntologySelection(storage, path);
    clearOntologySelection(storage);

    expect(storage.setItem).toHaveBeenCalledWith(ONTOLOGY_STORAGE_KEY, path);
    expect(storage.removeItem).toHaveBeenCalledWith(ONTOLOGY_STORAGE_KEY);
  });

  it("allows only the newest async request to commit", () => {
    const guard = createLatestRequestGuard();
    const firstRequest = guard.begin();
    const secondRequest = guard.begin();

    expect(guard.isLatest(firstRequest)).toBe(false);
    expect(guard.isLatest(secondRequest)).toBe(true);
  });
});

