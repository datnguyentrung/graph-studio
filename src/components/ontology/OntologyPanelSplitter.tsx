import {
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type PanelSide = "left" | "right";

type OntologyPanelSplitterProps = {
  side: PanelSide;
  panelLabel: string;
  controls: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  collapseThreshold: number;
  minimumRemainingWidth: number;
  onWidthChange: (width: number) => void;
  onWidthCommit: (width: number) => void;
  onToggle: () => void;
};

const KEYBOARD_STEP = 28;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
function getWorkspaceMetrics(
  splitter: HTMLElement,
  minimumRemainingWidth: number,
  maxWidth: number,
) {
  const workspace = splitter.closest<HTMLElement>(".ontology-workspace");
  if (!workspace) return null;
  const rect = workspace.getBoundingClientRect();
  const availableWidth = Math.max(0, rect.width - minimumRemainingWidth);
  return {
    rect,
    maxAllowedWidth: Math.min(maxWidth, availableWidth),
  };
}

function getPointerWidth(
  splitter: HTMLElement,
  clientX: number,
  side: PanelSide,
  minimumRemainingWidth: number,
  maxWidth: number,
) {
  const metrics = getWorkspaceMetrics(
    splitter,
    minimumRemainingWidth,
    maxWidth,
  );
  if (!metrics) return 0;
  const rawWidth = side === "left"
    ? clientX - metrics.rect.left
    : metrics.rect.right - clientX;
  return clamp(rawWidth, 0, metrics.maxAllowedWidth);
}

function snapWidth(
  width: number,
  minWidth: number,
  collapseThreshold: number,
  maxAllowedWidth: number,
) {
  if (width <= collapseThreshold) return 0;
  return Math.min(Math.max(width, minWidth), maxAllowedWidth);
}

export function OntologyPanelSplitter({
  side,
  panelLabel,
  controls,
  width,
  minWidth,
  maxWidth,
  collapseThreshold,
  minimumRemainingWidth,
  onWidthChange,
  onWidthCommit,
  onToggle,
}: OntologyPanelSplitterProps) {
  const [dragging, setDragging] = useState(false);
  const collapsed = width === 0;
  const action = collapsed ? "Expand" : "Collapse";
  const chevron = side === "left"
    ? (collapsed ? "›" : "‹")
    : (collapsed ? "‹" : "›");

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onWidthChange(getPointerWidth(
      event.currentTarget,
      event.clientX,
      side,
      minimumRemainingWidth,
      maxWidth,
    ));
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const metrics = getWorkspaceMetrics(
      event.currentTarget,
      minimumRemainingWidth,
      maxWidth,
    );
    const pointerWidth = getPointerWidth(
      event.currentTarget,
      event.clientX,
      side,
      minimumRemainingWidth,
      maxWidth,
    );
    const nextWidth = metrics
      ? snapWidth(
          pointerWidth,
          minWidth,
          collapseThreshold,
          metrics.maxAllowedWidth,
        )
      : pointerWidth;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    onWidthCommit(nextWidth);
  }

  function cancelDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    onWidthCommit(width);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const metrics = getWorkspaceMetrics(
      event.currentTarget,
      minimumRemainingWidth,
      maxWidth,
    );
    if (!metrics) return;

    const expandKey = side === "left" ? "ArrowRight" : "ArrowLeft";
    const collapseKey = side === "left" ? "ArrowLeft" : "ArrowRight";

    if (event.key === "Home") {
      event.preventDefault();
      onWidthCommit(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onWidthCommit(Math.min(maxWidth, metrics.maxAllowedWidth));
      return;
    }

    if (event.key !== expandKey && event.key !== collapseKey) return;
    event.preventDefault();
    const direction = event.key === expandKey ? 1 : -1;
    const baseWidth = width === 0 && direction > 0 ? minWidth : width;
    const nextWidth = clamp(
      baseWidth + direction * KEYBOARD_STEP,
      0,
      metrics.maxAllowedWidth,
    );
    onWidthCommit(nextWidth < minWidth ? 0 : nextWidth);
  }
  return (
    <div
      className={`ontology-panel-splitter-shell ontology-panel-splitter-shell--${side}${collapsed ? " ontology-panel-splitter-shell--collapsed" : ""}`}
    >
      <div
        className="ontology-panel-splitter"
        role="separator"
        aria-label={`Resize ${panelLabel}`}
        aria-controls={controls}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={maxWidth}
        aria-valuenow={Math.round(width)}
        aria-valuetext={collapsed ? "Collapsed" : `${Math.round(width)} pixels`}
        tabIndex={0}
        data-dragging={dragging ? "true" : "false"}
        data-collapsed={collapsed ? "true" : "false"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="ontology-panel-splitter__toggle"
        aria-label={`${action} ${panelLabel}`}
        aria-expanded={!collapsed}
        aria-controls={controls}
        title={`${action} ${panelLabel}`}
        onClick={onToggle}
      >
        <span aria-hidden="true">{chevron}</span>
      </button>
    </div>
  );
}
