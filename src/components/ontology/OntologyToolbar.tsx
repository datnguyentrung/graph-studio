import type { GraphViewState } from "../../services/ontology/projectOntologyGraph";
import {
  OntologyFileSelector,
  type OntologyFileSelectorProps,
} from "./OntologyFileSelector";
import type { LayoutName, LayoutTarget } from "./useCytoscapeGraph";

type OntologyToolbarProps = {
  ontologySelector: OntologyFileSelectorProps;
  selectedCount: number;
  viewMode: GraphViewState["mode"];
  progressive: boolean;
  canExpand: boolean;
  graphReady: boolean;
  layoutName: LayoutName;
  layoutTarget: LayoutTarget;
  fitAfterLayout: boolean;
  coseDisabled: boolean;
  layoutBlockedReason: string;
  processingLayout: boolean;
  onLayoutNameChange: (name: LayoutName) => void;
  onLayoutTargetChange: (target: LayoutTarget) => void;
  onFitAfterLayoutChange: (fit: boolean) => void;
  onRunLayout: () => void;
  onFit: () => void;
  onCenter: () => void;
  onResetView: () => void;
  onFocus: () => void;
  onHideSelected: () => void;
  onIsolateSelected: () => void;
  onShowNeighbors: () => void;
  onShowRelationships: () => void;
  onHideNeighbors: () => void;
  onBackToOverview: () => void;
  onExpandView: () => void;
  onResetVisibility: () => void;
  onCancelLayout: () => void;
};

export function OntologyToolbar({
  ontologySelector,
  selectedCount,
  viewMode,
  progressive,
  canExpand,
  graphReady,
  layoutName,
  layoutTarget,
  fitAfterLayout,
  coseDisabled,
  layoutBlockedReason,
  processingLayout,
  onLayoutNameChange,
  onLayoutTargetChange,
  onFitAfterLayoutChange,
  onRunLayout,
  onFit,
  onCenter,
  onResetView,
  onFocus,
  onHideSelected,
  onIsolateSelected,
  onShowNeighbors,
  onShowRelationships,
  onHideNeighbors,
  onBackToOverview,
  onExpandView,
  onResetVisibility,
  onCancelLayout,
}: OntologyToolbarProps) {
  const noSelection = selectedCount === 0;
  const selectedTargetUnavailable = layoutTarget === "selected" && noSelection;
  const layoutDisabled = !graphReady || coseDisabled || selectedTargetUnavailable;

  return (
    <div className="ontology-toolbar" aria-label="Graph actions">
      <div className="ontology-toolbar__source">
        <OntologyFileSelector {...ontologySelector} />
      </div>

      <div className="ontology-toolbar__actions">
        <div className="ontology-toolbar__group">
          <button type="button" onClick={onFit}>Fit graph</button>
          <button type="button" onClick={onCenter}>Center</button>
          <button type="button" onClick={onResetView}>Reset view</button>
        </div>

        <div className="ontology-toolbar__group ontology-toolbar__selection">
          <span>{selectedCount} selected</span>
          <button type="button" onClick={onFocus} disabled={noSelection}>Focus</button>
          <button type="button" onClick={onHideSelected} disabled={noSelection}>Hide</button>
          <button type="button" onClick={onIsolateSelected} disabled={noSelection}>Isolate</button>
          <button type="button" onClick={onShowNeighbors} disabled={noSelection}>1-hop</button>
          <button
            type="button"
            onClick={onShowRelationships}
            disabled={noSelection || !progressive}
          >
            Relationships
          </button>
          <button type="button" onClick={onHideNeighbors} disabled={noSelection}>Hide neighbors</button>
        </div>

        <div className="ontology-toolbar__group ontology-toolbar__view">
          <span className="ontology-toolbar__mode">{viewMode}</span>
          <button
            type="button"
            onClick={onBackToOverview}
            disabled={progressive ? viewMode === "overview" : viewMode === "full"}
          >
            {progressive ? "Back to overview" : "Back to full graph"}
          </button>
          <button type="button" onClick={onExpandView} disabled={!canExpand}>
            {progressive ? "Expand / collapse" : "Expand view"}
          </button>
          <button type="button" onClick={onResetVisibility}>Reset visibility</button>
        </div>

        <div className="ontology-toolbar__group ontology-toolbar__layout">
          <label>
            <span>Layout</span>
            <select
              value={layoutName}
              onChange={(event) => onLayoutNameChange(event.target.value as LayoutName)}
            >
              <option value="breadthfirst">Breadthfirst</option>
              <option value="grid">Grid</option>
              <option value="circle">Circle</option>
              <option value="concentric">Concentric</option>
              <option value="cose" disabled={coseDisabled}>CoSE</option>
            </select>
          </label>
          <label>
            <span>Target</span>
            <select
              value={layoutTarget}
              onChange={(event) => onLayoutTargetChange(event.target.value as LayoutTarget)}
            >
              <option value="current">Current view</option>
              <option value="selected">Selected</option>
            </select>
          </label>
          <label className="ontology-toolbar__check">
            <input
              type="checkbox"
              checked={fitAfterLayout}
              onChange={(event) => onFitAfterLayoutChange(event.target.checked)}
            />
            Fit
          </label>
          <button
            type="button"
            className="ontology-button--primary"
            onClick={onRunLayout}
            disabled={layoutDisabled}
            title={layoutBlockedReason || undefined}
          >
            Run layout
          </button>
          <button
            type="button"
            onClick={onCancelLayout}
            disabled={!processingLayout}
          >
            Cancel layout
          </button>
        </div>
      </div>
    </div>
  );
}
