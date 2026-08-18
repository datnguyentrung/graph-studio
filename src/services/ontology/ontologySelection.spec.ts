import { describe, expect, it, vi } from "vitest";
import {
  buildOntologySourceUrl,
  ONTOLOGY_STORAGE_KEY,
  clearOntologySelection,
  createLatestRequestGuard,
  persistOntologySelection,
  resolveOntologySelection,
  resolveOntologySourceParam,
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

  it("prefers a valid source param over stored selection", () => {
    const storage = storageWith("all.ontology.json");
    const sourcePath = "LOAN/all_loan.ontology.json";

    expect(resolveOntologySourceParam(`?source=${encodeURIComponent(sourcePath)}`))
      .toBe(sourcePath);
    expect(
      resolveOntologySelection(
        storage,
        `?source=${encodeURIComponent(sourcePath)}`,
      ),
    ).toEqual({
      path: sourcePath,
      sourcePath,
      invalidSourcePath: null,
    });
  });

  it("falls back to stored selection when source param is missing", () => {
    const storedPath = "LOAN/all_loan.ontology.json";
    const storage = storageWith(storedPath);

    expect(resolveOntologySelection(storage, "")).toEqual({
      path: storedPath,
      sourcePath: null,
      invalidSourcePath: null,
    });
  });

  it("reports an invalid source param without selecting it", () => {
    const storage = storageWith("all.ontology.json");

    expect(resolveOntologySelection(storage, "?source=missing.ontology.json"))
      .toEqual({
        path: "all.ontology.json",
        sourcePath: null,
        invalidSourcePath: "missing.ontology.json",
      });
  });

  it("builds an encoded ontology source URL", () => {
    expect(
      buildOntologySourceUrl(
        "/ontology",
        "?panel=filters",
        "LOAN/all_loan.ontology.json",
      ),
    ).toBe("/ontology?panel=filters&source=LOAN%2Fall_loan.ontology.json");
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

