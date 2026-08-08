import type {
  LayoutName,
  LayoutTarget,
} from "./useCytoscapeGraph";

type OntologyToolbarProps = {
  selectedCount: number;
  layoutName: LayoutName;
  layoutTarget: LayoutTarget;
  fitAfterLayout: boolean;
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
  onExpandNeighbors: () => void;
  onHideNeighbors: () => void;
  onRestoreHidden: () => void;
  onShowAll: () => void;
};

export function OntologyToolbar({
  selectedCount,
  layoutName,
  layoutTarget,
  fitAfterLayout,
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
  onExpandNeighbors,
  onHideNeighbors,
  onRestoreHidden,
  onShowAll,
}: OntologyToolbarProps) {
  const noSelection = selectedCount === 0;

  return (
    <div className="ontology-toolbar" aria-label="Graph actions">
      <div className="ontology-toolbar__group">
        <button type="button" onClick={onFit}>Fit graph</button>
        <button type="button" onClick={onCenter}>Center</button>
        <button type="button" onClick={onResetView}>Reset view</button>
        <button type="button" onClick={onFocus} disabled={noSelection}>Focus</button>
      </div>

      <div className="ontology-toolbar__group ontology-toolbar__selection">
        <span>{selectedCount} selected</span>
        <button type="button" onClick={onHideSelected} disabled={noSelection}>Hide</button>
        <button type="button" onClick={onIsolateSelected} disabled={noSelection}>Isolate</button>
        <button type="button" onClick={onShowNeighbors} disabled={noSelection}>1-hop</button>
        <button type="button" onClick={onExpandNeighbors} disabled={noSelection}>Expand</button>
        <button type="button" onClick={onHideNeighbors} disabled={noSelection}>Hide neighbors</button>
        <button type="button" onClick={onRestoreHidden}>Restore hidden</button>
        <button type="button" onClick={onShowAll}>Show all</button>
      </div>

      <div className="ontology-toolbar__group ontology-toolbar__layout">
        <label>
          <span>Layout</span>
          <select
            value={layoutName}
            onChange={(event) => onLayoutNameChange(event.target.value as LayoutName)}
          >
            <option value="cose">Cose</option>
            <option value="breadthfirst">Breadthfirst</option>
            <option value="circle">Circle</option>
            <option value="concentric">Concentric</option>
            <option value="grid">Grid</option>
          </select>
        </label>
        <label>
          <span>Target</span>
          <select
            value={layoutTarget}
            onChange={(event) => onLayoutTargetChange(event.target.value as LayoutTarget)}
          >
            <option value="all">All</option>
            <option value="visible">Visible</option>
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
        <button type="button" className="ontology-button--primary" onClick={onRunLayout}>
          Run layout
        </button>
      </div>
    </div>
  );
}
