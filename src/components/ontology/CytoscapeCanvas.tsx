import { useId, type KeyboardEvent, type RefObject } from "react";
import type {
  GraphProjectionResult,
  GraphViewState,
} from "../../services/ontology/projectOntologyGraph";
import {
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  type GraphRuntimeStatus,
} from "./useCytoscapeGraph";

type CytoscapeCanvasProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  zoomPercent: number;
  onZoomPercentChange: (percent: number) => void;
  status: GraphRuntimeStatus;
  statusMessage: string;
  mountedElementCount: number;
  totalElementCount: number;
  layoutElapsedMs: number;
  onCancelLayout: () => void;
  onRunCoseLayout: () => void;
  projection: GraphProjectionResult;
  viewMode: GraphViewState["mode"];
  progressive: boolean;
};

export function CytoscapeCanvas({
  containerRef,
  onKeyDown,
  zoomPercent,
  onZoomPercentChange,
  status,
  statusMessage,
  mountedElementCount,
  totalElementCount,
  layoutElapsedMs,
  onCancelLayout,
  onRunCoseLayout,
  projection,
  viewMode,
  progressive,
}: CytoscapeCanvasProps) {
  const zoomControlId = useId();
  const busy = status === "loading-data" ||
    status === "building-model" ||
    status === "mounting-graph" ||
    status === "processing-layout" ||
    status === "layouting";
  const processingLayout = status === "processing-layout";
  const modeLabel = viewMode === "full"
    ? "Full graph"
    : viewMode === "overview"
      ? "Overview"
      : viewMode === "hierarchy" ? "Hierarchy" : "Focus";

  return (
    <div className="ontology-canvas-wrap">
      <div
        ref={containerRef}
        className="ontology-canvas"
        aria-label="Interactive ontology graph"
        aria-describedby="ontology-canvas-hint ontology-graph-status"
        aria-busy={busy}
        role="region"
        tabIndex={0}
        onKeyDown={onKeyDown}
        title={progressive
          ? "Double-click a domain, module, or class to expand or collapse it"
          : undefined}
      />

      <div
        id="ontology-graph-status"
        className={`ontology-graph-budget${projection.truncated ? " ontology-graph-budget--limited" : ""}`}
        aria-live="polite"
      >
        <div className="ontology-graph-budget__heading">
          <span className="ontology-eyebrow">Graph view</span>
          <strong>{modeLabel}</strong>
        </div>
        <div className="ontology-graph-budget__counts">
          <span>
            <strong>{projection.nodeIds.length}</strong>
            <span>/ {projection.indexedNodeCount} nodes</span>
          </span>
          <span>
            <strong>{projection.edgeIds.length}</strong>
            <span>/ {projection.indexedEdgeCount} edges</span>
          </span>
        </div>
        {busy && (
          <span className="ontology-graph-budget__status">
            <span className="ontology-source-tree__loading" aria-hidden="true" />
            {statusMessage}
          </span>
        )}
        {status === "mounting-graph" && (
          <span className="ontology-graph-budget__status">
            Mounted {mountedElementCount.toLocaleString()} / {totalElementCount.toLocaleString()} elements
          </span>
        )}
        {processingLayout && (
          <div className="ontology-graph-budget__processing">
            <span>
              Processing CoSE layout · {(layoutElapsedMs / 1000).toFixed(1)}s
            </span>
            <button type="button" onClick={onCancelLayout}>Cancel layout</button>
          </div>
        )}
        {status === "error" && (
          <span className="ontology-graph-budget__error" role="alert">
            {statusMessage}
          </span>
        )}
        {(status === "ready" || status === "error") && (
          <button type="button" onClick={onRunCoseLayout}>
            Run CoSE again
          </button>
        )}
        {projection.truncated && (
          <span className="ontology-graph-budget__limit">
            View limit reached. Collapse another branch, search, or focus a concept.
          </span>
        )}
      </div>

      <div className="ontology-zoom-control">
        <div className="ontology-zoom-control__header">
          <label htmlFor={zoomControlId}>Zoom</label>
          <output htmlFor={zoomControlId}>{zoomPercent}%</output>
        </div>
        <input
          id={zoomControlId}
          type="range"
          min={MIN_ZOOM_PERCENT}
          max={MAX_ZOOM_PERCENT}
          step="1"
          value={zoomPercent}
          aria-valuetext={`${zoomPercent}%`}
          onChange={(event) => onZoomPercentChange(Number(event.target.value))}
        />
      </div>
      <div id="ontology-canvas-hint" className="ontology-canvas__hint">
        Scroll: zoom · drag: pan · arrows: inspect · Shift + arrows: multi-select
        {progressive ? " · double-click/Enter/Space: expand or collapse" : ""} · Esc: clear
      </div>
    </div>
  );
}
