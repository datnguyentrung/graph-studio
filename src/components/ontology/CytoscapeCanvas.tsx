import { useId, type KeyboardEvent, type RefObject } from "react";
import {
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
} from "./useCytoscapeGraph";

type CytoscapeCanvasProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  zoomPercent: number;
  onZoomPercentChange: (percent: number) => void;
};

export function CytoscapeCanvas({
  containerRef,
  onKeyDown,
  zoomPercent,
  onZoomPercentChange,
}: CytoscapeCanvasProps) {
  const zoomControlId = useId();

  return (
    <div className="ontology-canvas-wrap">
      <div
        ref={containerRef}
        className="ontology-canvas"
        aria-label="Interactive ontology graph"
        aria-describedby="ontology-canvas-hint"
        role="region"
        tabIndex={0}
        onKeyDown={onKeyDown}
      />
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
        Scroll: zoom · drag: pan · arrows: inspect · Shift + arrows: multi-select · Esc: clear
      </div>
    </div>
  );
}
