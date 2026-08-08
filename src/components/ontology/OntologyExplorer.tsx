import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  CytoscapeGraphModel,
  OntologyDocument,
} from "../../services/ontology/types";
import { matchesNodeSearch } from "../../utils/ontology/searchOntology";
import { CytoscapeCanvas } from "./CytoscapeCanvas";
import {
  OntologyFilters,
} from "./OntologyFilters";
import {
  createDefaultFilters,
  type OntologyFilterState,
} from "../../services/ontology/visibilityTypes";
import { OntologyDetailPanel } from "./OntologyDetailPanel";
import { OntologyToolbar } from "./OntologyToolbar";
import {
  useCytoscapeGraph,
  type LayoutName,
  type LayoutTarget,
} from "./useCytoscapeGraph";

type OntologyExplorerProps = {
  document: OntologyDocument;
  model: CytoscapeGraphModel;
  sourceLabel: string;
  subPath: string;
};

function addToSet(source: Set<string>, values: string[]): Set<string> {
  const next = new Set(source);
  for (const value of values) next.add(value);
  return next;
}

export function OntologyExplorer({
  document,
  model,
  sourceLabel,
  subPath,
}: OntologyExplorerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<OntologyFilterState>(() =>
    createDefaultFilters(model.facets),
  );
  const [manuallyHiddenIds, setManuallyHiddenIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isolatedIds, setIsolatedIds] = useState<Set<string> | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [layoutName, setLayoutName] = useState<LayoutName>("cose");
  const [layoutTarget, setLayoutTarget] = useState<LayoutTarget>("visible");
  const [fitAfterLayout, setFitAfterLayout] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    if (ids.length > 0) setShowMobileDetail(true);
  }, []);
  const graph = useCytoscapeGraph({
    elements: model.elements,
    onSelectionChange: handleSelectionChange,
  });

  useEffect(() => {
    graph.applyVisibility({
      ...filters,
      manuallyHiddenIds,
      isolatedIds,
      revealedIds,
    });
  }, [
    filters,
    graph,
    isolatedIds,
    manuallyHiddenIds,
    revealedIds,
  ]);

  const searchResults = useMemo(
    () =>
      [...model.nodeIndex.values()]
        .filter((node) => matchesNodeSearch(node, searchQuery))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [model.nodeIndex, searchQuery],
  );

  const internalCount = [...model.nodeIndex.values()].filter(
    (node) => node.scope === "internal" && node.nodeType !== "PROPERTY",
  ).length;
  const propertyCount = [...model.nodeIndex.values()].filter(
    (node) => node.nodeType === "PROPERTY",
  ).length;

  function chooseSearchResult(id: string) {
    setManuallyHiddenIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setRevealedIds((current) => addToSet(current, [id]));
    window.setTimeout(() => graph.focusElement(id), 0);
  }

  function hideSelected() {
    setManuallyHiddenIds((current) => addToSet(current, selectedIds));
    setRevealedIds((current) => {
      const next = new Set(current);
      for (const id of selectedIds) next.delete(id);
      return next;
    });
  }

  function isolateSelected() {
    setIsolatedIds(new Set(graph.getNeighborhoodIds(selectedIds, 0)));
  }

  function showNeighbors(depth: number) {
    const neighborhood = graph.getNeighborhoodIds(selectedIds, depth);
    setManuallyHiddenIds((current) => {
      const next = new Set(current);
      for (const id of neighborhood) next.delete(id);
      return next;
    });
    setRevealedIds((current) => addToSet(current, neighborhood));
    if (isolatedIds) setIsolatedIds(new Set(neighborhood));
  }

  function hideNeighbors() {
    const selected = new Set(selectedIds);
    const neighbors = graph
      .getNeighborhoodIds(selectedIds, 1)
      .filter((id) => !selected.has(id));
    setManuallyHiddenIds((current) => addToSet(current, neighbors));
    setRevealedIds((current) => {
      const next = new Set(current);
      for (const id of neighbors) next.delete(id);
      return next;
    });
  }

  function restoreHidden() {
    setManuallyHiddenIds(new Set());
    setIsolatedIds(null);
    setRevealedIds(new Set());
  }

  function resetFilters() {
    setFilters(createDefaultFilters(model.facets));
    restoreHidden();
  }

  function showAll() {
    setFilters({
      ...createDefaultFilters(model.facets),
      showProperties: true,
    });
    restoreHidden();
  }

  function changeFilters(nextFilters: OntologyFilterState) {
    setFilters(nextFilters);
    setRevealedIds(new Set());
  }

  function changeSearchQuery(query: string) {
    setSearchQuery(query);
    setRevealedIds(new Set());
  }

  function handleCanvasKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      graph.cycleVisibleSelection(1, event.shiftKey);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      graph.cycleVisibleSelection(-1, event.shiftKey);
    } else if (event.key === "Escape") {
      event.preventDefault();
      graph.clearSelection();
    }
  }

  return (
    <main className="ontology-page">
      <header className="ontology-header">
        <div>
          <div className="ontology-breadcrumb">
            <a href="/mermaid">Mermaid</a>
            <span>/</span>
            <strong>Ontology{`${subPath ? ` / ${subPath}` : ""}`}</strong>
          </div>
          <h1>Ontology Explorer</h1>
        </div>
        <div className="ontology-dataset">
          <span className="ontology-eyebrow">Active source</span>
          <strong>{sourceLabel}</strong>
          <span className="ontology-mono">{document.ontologyBase ?? "Unknown ontology base"}</span>
        </div>
        <div className="ontology-stats" aria-label="Graph summary">
          <span><strong>{internalCount}</strong> classes</span>
          <span><strong>{model.edgeIndex.size}</strong> relations</span>
          <span><strong>{propertyCount}</strong> properties</span>
          <span><strong>{model.diagnostics.externalReferences.length}</strong> external</span>
        </div>
      </header>

      <OntologyToolbar
        selectedCount={selectedIds.length}
        layoutName={layoutName}
        layoutTarget={layoutTarget}
        fitAfterLayout={fitAfterLayout}
        onLayoutNameChange={setLayoutName}
        onLayoutTargetChange={setLayoutTarget}
        onFitAfterLayoutChange={setFitAfterLayout}
        onRunLayout={() => graph.runLayout(layoutName, layoutTarget, fitAfterLayout)}
        onFit={graph.fit}
        onCenter={graph.centerSelected}
        onResetView={graph.resetView}
        onFocus={() => selectedIds[0] && graph.focusElement(selectedIds[0])}
        onHideSelected={hideSelected}
        onIsolateSelected={isolateSelected}
        onShowNeighbors={() => showNeighbors(1)}
        onExpandNeighbors={() => showNeighbors(2)}
        onHideNeighbors={hideNeighbors}
        onRestoreHidden={restoreHidden}
        onShowAll={showAll}
      />

      {model.diagnostics.unresolvedRelationships.length > 0 && (
        <div className="ontology-warning" role="status">
          {model.diagnostics.unresolvedRelationships.length} relationships were kept in diagnostics because domain or range is missing.
        </div>
      )}

      <div className="ontology-mobile-panels" aria-label="Mobile panels">
        <button
          type="button"
          aria-expanded={showMobileFilters}
          onClick={() => setShowMobileFilters((current) => !current)}
        >
          Filters
        </button>
        <button
          type="button"
          aria-expanded={showMobileDetail}
          onClick={() => setShowMobileDetail((current) => !current)}
        >
          Details
        </button>
      </div>

      <div
        className={`ontology-workspace${showMobileFilters ? " ontology-workspace--show-filters" : ""}${showMobileDetail ? " ontology-workspace--show-detail" : ""}`}
      >
        <OntologyFilters
          facets={model.facets}
          filters={filters}
          onFiltersChange={changeFilters}
          onReset={resetFilters}
          searchQuery={searchQuery}
          onSearchQueryChange={changeSearchQuery}
          searchResults={searchResults}
          onChooseSearchResult={chooseSearchResult}
        />
        <CytoscapeCanvas
          containerRef={graph.containerRef}
          onKeyDown={handleCanvasKeyDown}
        />
        <OntologyDetailPanel model={model} selectedIds={selectedIds} />
      </div>
    </main>
  );
}
