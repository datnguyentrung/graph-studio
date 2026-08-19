import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  chooseOntologyRenderingStrategy,
  createDefaultGraphView,
  getOntologyNeighborhoodIds,
  isHierarchyNodeExpanded,
  projectOntologyGraph,
  setHierarchyRelationshipSeed,
  toFocusView,
  toHierarchyViewForNode,
  toggleHierarchyExpansion,
  type GraphViewState,
} from "../../services/ontology/projectOntologyGraph";
import type {
  CytoscapeGraphModel,
  OntologyDocument,
} from "../../services/ontology/types";
import {
  createDefaultFilters,
  type OntologyFilterState,
  type VisibilityState,
} from "../../services/ontology/visibilityTypes";
import { matchesNodeSearch } from "../../utils/ontology/searchOntology";
import { CytoscapeCanvas } from "./CytoscapeCanvas";
import { OntologyDetailPanel } from "./OntologyDetailPanel";
import type { OntologyFileSelectorProps } from "./OntologyFileSelector";
import { OntologyFilters } from "./OntologyFilters";
import { OntologyPanelSplitter } from "./OntologyPanelSplitter";
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
  ontologySelector: OntologyFileSelectorProps;
  ontologyLoadError: string;
  subPath: string;
};

const FILTER_PANEL_DEFAULT_WIDTH = 272;
const FILTER_PANEL_MIN_WIDTH = 180;
const FILTER_PANEL_MAX_WIDTH = 480;
const DETAIL_PANEL_DEFAULT_WIDTH = 336;
const DETAIL_PANEL_MIN_WIDTH = 220;
const DETAIL_PANEL_MAX_WIDTH = 560;
const PANEL_COLLAPSE_THRESHOLD = 120;
const CANVAS_MIN_WIDTH = 300;
const SPLITTERS_TOTAL_WIDTH = 20;

function updateSet(
  source: Set<string>,
  values: readonly string[],
  add: boolean,
): Set<string> {
  const next = new Set(source);
  for (const value of values) {
    if (add) next.add(value);
    else next.delete(value);
  }
  return next;
}

export function OntologyExplorer({
  document,
  model,
  sourceLabel,
  ontologySelector,
  ontologyLoadError,
  subPath,
}: OntologyExplorerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filters, setFilters] = useState<OntologyFilterState>(() =>
    createDefaultFilters(model.facets),
  );
  const [manuallyHiddenIds, setManuallyHiddenIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isolatedIds, setIsolatedIds] = useState<Set<string> | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const renderingStrategy = useMemo(
    () => chooseOntologyRenderingStrategy(model),
    [model],
  );
  const [view, setView] = useState<GraphViewState>(() =>
    createDefaultGraphView(renderingStrategy),
  );
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState<LayoutName>(
    renderingStrategy === "progressive" ? "breadthfirst" : "cose",
  );
  const [layoutTarget, setLayoutTarget] = useState<LayoutTarget>("current");
  const [fitAfterLayout, setFitAfterLayout] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [filterPanelWidth, setFilterPanelWidth] = useState(
    FILTER_PANEL_DEFAULT_WIDTH,
  );
  const [detailPanelWidth, setDetailPanelWidth] = useState(
    DETAIL_PANEL_DEFAULT_WIDTH,
  );
  const lastFilterPanelWidth = useRef(FILTER_PANEL_DEFAULT_WIDTH);
  const lastDetailPanelWidth = useRef(DETAIL_PANEL_DEFAULT_WIDTH);

  const visibility = useMemo<VisibilityState>(
    () => ({
      ...filters,
      manuallyHiddenIds,
      isolatedIds,
      revealedIds,
    }),
    [filters, isolatedIds, manuallyHiddenIds, revealedIds],
  );
  const projection = useMemo(
    () => projectOntologyGraph(model, view, visibility),
    [model, view, visibility],
  );

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    if (ids.length > 0) setShowMobileDetail(true);
  }, []);
  const activateProgressiveNode = useCallback((nodeId: string | undefined) => {
    if (renderingStrategy !== "progressive" || !nodeId) return;
    setView((current) => {
      if (projection.truncated && !isHierarchyNodeExpanded(current, nodeId)) {
        return current;
      }
      return toggleHierarchyExpansion(model, current, nodeId);
    });
  }, [model, projection.truncated, renderingStrategy]);
  const graph = useCytoscapeGraph({
    elements: projection.elements,
    onSelectionChange: handleSelectionChange,
    onNodePrimaryAction: renderingStrategy === "progressive"
      ? activateProgressiveNode
      : undefined,
    automaticLayoutName: renderingStrategy === "progressive"
      ? "breadthfirst"
      : undefined,
  });

  useEffect(() => {
    if (
      !pendingFocusId ||
      (graph.status !== "ready" && graph.status !== "processing-layout") ||
      !projection.nodeIds.includes(pendingFocusId)
    ) return;
    const frame = window.requestAnimationFrame(() => {
      graph.focusElement(pendingFocusId);
      setPendingFocusId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [graph, pendingFocusId, projection.nodeIds]);

  const searchResults = useMemo(
    () =>
      [...model.nodeIndex.values()]
        .filter((node) => matchesNodeSearch(node, deferredSearchQuery))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [deferredSearchQuery, model.nodeIndex],
  );
  const { internalCount, propertyCount } = useMemo(() => {
    let nextInternalCount = 0;
    let nextPropertyCount = 0;
    for (const node of model.nodeIndex.values()) {
      if (node.nodeType === "PROPERTY") nextPropertyCount += 1;
      else if (node.scope === "internal") nextInternalCount += 1;
    }
    return {
      internalCount: nextInternalCount,
      propertyCount: nextPropertyCount,
    };
  }, [model.nodeIndex]);

  function revealElements(ids: readonly string[]) {
    setManuallyHiddenIds((current) => updateSet(current, ids, false));
    setRevealedIds((current) => updateSet(current, ids, true));
  }

  function hideElements(ids: readonly string[]) {
    setManuallyHiddenIds((current) => updateSet(current, ids, true));
    setRevealedIds((current) => updateSet(current, ids, false));
  }

  function chooseSearchResult(id: string) {
    revealElements([id]);
    setView(
      renderingStrategy === "progressive"
        ? toHierarchyViewForNode(model, id)
        : toFocusView(model, [id]),
    );
    setPendingFocusId(id);
  }

  function focusSelection(depth = 0) {
    if (selectedIds.length === 0) return;
    setView(toFocusView(model, selectedIds, depth));
    setPendingFocusId(selectedIds[0]);
  }

  function isolateSelected() {
    if (selectedIds.length === 0) return;
    const neighborhood = getOntologyNeighborhoodIds(model, selectedIds, 0);
    const isolated = [...neighborhood.nodeIds, ...neighborhood.edgeIds];
    setIsolatedIds(new Set(isolated));
    revealElements(isolated);
    setView(toFocusView(model, selectedIds, 0));
  }

  function showNeighbors(depth: number) {
    if (selectedIds.length === 0) return;
    const neighborhood = getOntologyNeighborhoodIds(model, selectedIds, depth);
    const ids = [...neighborhood.nodeIds, ...neighborhood.edgeIds];
    revealElements(ids);
    setIsolatedIds((current) => current ? new Set(ids) : current);
    setView(toFocusView(model, selectedIds, depth));
  }

  function hideNeighbors() {
    if (selectedIds.length === 0) return;
    const selected = new Set(selectedIds);
    const neighborhood = getOntologyNeighborhoodIds(model, selectedIds, 1);
    hideElements(
      [...neighborhood.nodeIds, ...neighborhood.edgeIds].filter(
        (id) => !selected.has(id),
      ),
    );
  }

  function resetVisibility() {
    setManuallyHiddenIds(new Set());
    setIsolatedIds(null);
    setRevealedIds(new Set());
  }

  function resetFilters() {
    setFilters(createDefaultFilters(model.facets));
    resetVisibility();
  }

  function backToFullGraph() {
    setView(createDefaultGraphView(renderingStrategy));
    setPendingFocusId(null);
    graph.clearSelection();
  }

  function expandView() {
    if (renderingStrategy === "progressive") {
      activateProgressiveNode(selectedIds[0]);
      return;
    }
    setView((current) => {
      if (current.mode === "focus") {
        return { ...current, depth: current.depth + 1 };
      }
      if (current.mode === "full") {
        return selectedIds.length > 0
          ? toFocusView(model, selectedIds, 2)
          : { mode: "overview" };
      }
      if (selectedIds.length > 0) {
        return toFocusView(model, selectedIds, 2);
      }
      return { mode: "overview" };
    });
  }

  function showRelationships() {
    const realSelectedIds = selectedIds.filter((id) => model.nodeIndex.has(id));
    if (renderingStrategy !== "progressive" || realSelectedIds.length === 0) return;
    setView((current) => setHierarchyRelationshipSeed(current, realSelectedIds));
  }

  function changeFilters(nextFilters: OntologyFilterState) {
    setFilters(nextFilters);
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
    } else if (
      renderingStrategy === "progressive" &&
      (event.key === "Enter" || event.key === " ") &&
      selectedIds.length > 0
    ) {
      event.preventDefault();
      activateProgressiveNode(selectedIds[0]);
    }
  }

  const graphReady = graph.status === "ready" ||
    graph.status === "processing-layout" ||
    graph.status === "error";

  function commitFilterPanelWidth(width: number) {
    const nextWidth = width === 0
      ? 0
      : Math.min(
          FILTER_PANEL_MAX_WIDTH,
          Math.max(FILTER_PANEL_MIN_WIDTH, width),
        );
    if (nextWidth > 0) lastFilterPanelWidth.current = nextWidth;
    setFilterPanelWidth(nextWidth);
  }

  function commitDetailPanelWidth(width: number) {
    const nextWidth = width === 0
      ? 0
      : Math.min(
          DETAIL_PANEL_MAX_WIDTH,
          Math.max(DETAIL_PANEL_MIN_WIDTH, width),
        );
    if (nextWidth > 0) lastDetailPanelWidth.current = nextWidth;
    setDetailPanelWidth(nextWidth);
  }

  function toggleFilterPanel() {
    if (filterPanelWidth === 0) {
      commitFilterPanelWidth(lastFilterPanelWidth.current);
      return;
    }
    lastFilterPanelWidth.current = filterPanelWidth;
    setFilterPanelWidth(0);
  }

  function toggleDetailPanel() {
    if (detailPanelWidth === 0) {
      commitDetailPanelWidth(lastDetailPanelWidth.current);
      return;
    }
    lastDetailPanelWidth.current = detailPanelWidth;
    setDetailPanelWidth(0);
  }

  const workspaceStyle = {
    "--ontology-filter-width": `${filterPanelWidth}px`,
    "--ontology-detail-width": `${detailPanelWidth}px`,
  } as CSSProperties;
  const workspaceClassName = `ontology-workspace${
    showMobileFilters ? " ontology-workspace--show-filters" : ""
  }${showMobileDetail ? " ontology-workspace--show-detail" : ""}${
    filterPanelWidth === 0 ? " ontology-workspace--filters-collapsed" : ""
  }${detailPanelWidth === 0 ? " ontology-workspace--detail-collapsed" : ""}`;

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
          <span className="ontology-mono">
            {document.ontologyBase ?? "Unknown ontology base"}
          </span>
        </div>
        <div className="ontology-stats" aria-label="Graph summary">
          <span><strong>{internalCount}</strong> classes</span>
          <span><strong>{model.edgeIndex.size}</strong> relations</span>
          <span><strong>{propertyCount}</strong> properties</span>
          <span><strong>{model.diagnostics.externalReferences.length}</strong> external</span>
        </div>
      </header>

      <OntologyToolbar
        ontologySelector={ontologySelector}
        selectedCount={selectedIds.length}
        viewMode={view.mode}
        progressive={renderingStrategy === "progressive"}
        canExpand={
          renderingStrategy === "progressive"
            ? selectedIds.length > 0 && !projection.truncated
            : view.mode !== "full" && !projection.truncated
        }
        graphReady={graphReady}
        layoutName={layoutName}
        layoutTarget={layoutTarget}
        fitAfterLayout={fitAfterLayout}
        coseDisabled={!graph.canRunCose}
        layoutBlockedReason=""
        processingLayout={graph.status === "processing-layout"}
        onLayoutNameChange={setLayoutName}
        onLayoutTargetChange={setLayoutTarget}
        onFitAfterLayoutChange={setFitAfterLayout}
        onRunLayout={() => graph.runLayout(layoutName, layoutTarget, fitAfterLayout)}
        onFit={graph.fit}
        onCenter={graph.centerSelected}
        onResetView={graph.resetView}
        onFocus={() => focusSelection(0)}
        onHideSelected={() => hideElements(selectedIds)}
        onIsolateSelected={isolateSelected}
        onShowNeighbors={() => showNeighbors(1)}
        onShowRelationships={showRelationships}
        onHideNeighbors={hideNeighbors}
        onBackToOverview={backToFullGraph}
        onExpandView={expandView}
        onResetVisibility={resetVisibility}
        onCancelLayout={graph.cancelLayout}
      />

      {(ontologyLoadError || model.diagnostics.unresolvedRelationships.length > 0) && (
        <div className="ontology-notices">
          {ontologyLoadError && (
            <div className="ontology-warning ontology-warning--error" role="alert">
              {ontologyLoadError} The current ontology remains active.
            </div>
          )}
          {model.diagnostics.unresolvedRelationships.length > 0 && (
            <div className="ontology-warning" role="status">
              {model.diagnostics.unresolvedRelationships.length} relationships were kept in diagnostics because domain or range is missing.
            </div>
          )}
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

      <div className={workspaceClassName} style={workspaceStyle}>
        <OntologyFilters
          facets={model.facets}
          filters={filters}
          onFiltersChange={changeFilters}
          onReset={resetFilters}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={searchResults}
          onChooseSearchResult={chooseSearchResult}
        />
        <OntologyPanelSplitter
          side="left"
          panelLabel="filters panel"
          controls="ontology-filters-panel"
          width={filterPanelWidth}
          minWidth={FILTER_PANEL_MIN_WIDTH}
          maxWidth={FILTER_PANEL_MAX_WIDTH}
          collapseThreshold={PANEL_COLLAPSE_THRESHOLD}
          minimumRemainingWidth={
            CANVAS_MIN_WIDTH +
            SPLITTERS_TOTAL_WIDTH +
            (detailPanelWidth === 0 ? 0 : DETAIL_PANEL_MIN_WIDTH)
          }
          onWidthChange={setFilterPanelWidth}
          onWidthCommit={commitFilterPanelWidth}
          onToggle={toggleFilterPanel}
        />
        <CytoscapeCanvas
          containerRef={graph.containerRef}
          onKeyDown={handleCanvasKeyDown}
          zoomPercent={graph.zoomPercent}
          onZoomPercentChange={graph.setZoomPercent}
          status={graph.status}
          statusMessage={graph.statusMessage}
          mountedElementCount={graph.mountedElementCount}
          totalElementCount={graph.totalElementCount}
          layoutElapsedMs={graph.layoutElapsedMs}
          onCancelLayout={graph.cancelLayout}
          onRunCoseLayout={() => graph.runLayout("cose", "current", true)}
          projection={projection}
          viewMode={view.mode}
          progressive={renderingStrategy === "progressive"}
        />
        <OntologyPanelSplitter
          side="right"
          panelLabel="details panel"
          controls="ontology-detail-panel"
          width={detailPanelWidth}
          minWidth={DETAIL_PANEL_MIN_WIDTH}
          maxWidth={DETAIL_PANEL_MAX_WIDTH}
          collapseThreshold={PANEL_COLLAPSE_THRESHOLD}
          minimumRemainingWidth={
            CANVAS_MIN_WIDTH +
            SPLITTERS_TOTAL_WIDTH +
            (filterPanelWidth === 0 ? 0 : FILTER_PANEL_MIN_WIDTH)
          }
          onWidthChange={setDetailPanelWidth}
          onWidthCommit={commitDetailPanelWidth}
          onToggle={toggleDetailPanel}
        />
        <OntologyDetailPanel model={model} selectedIds={selectedIds} />
      </div>
    </main>
  );
}
