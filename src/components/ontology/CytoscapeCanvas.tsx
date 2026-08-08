import type { KeyboardEvent, RefObject } from "react";

type CytoscapeCanvasProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export function CytoscapeCanvas({ containerRef, onKeyDown }: CytoscapeCanvasProps) {
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
      <div id="ontology-canvas-hint" className="ontology-canvas__hint">
        Scroll: zoom · drag: pan · arrows: inspect · Shift + arrows: multi-select · Esc: clear
      </div>
    </div>
  );
}
