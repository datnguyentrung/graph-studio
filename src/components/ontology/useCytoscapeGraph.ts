import cytoscape, {
  type Core,
  type ElementDefinition,
  type LayoutOptions,
} from "cytoscape";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  OntologyEdgeData,
  OntologyNodeData,
} from "../../services/ontology/types";
import type { VisibilityState } from "../../services/ontology/visibilityTypes";
import { isOntologyElementVisible } from "../../utils/ontology/ontologyVisibility";
import { cytoscapeStyles } from "./cytoscapeStyles";

export type LayoutName =
  | "cose"
  | "breadthfirst"
  | "circle"
  | "concentric"
  | "grid";
export type LayoutTarget = "all" | "visible" | "selected";

export const MIN_ZOOM_PERCENT = 50;
export const MAX_ZOOM_PERCENT = 500;
const DEFAULT_ZOOM_PERCENT = 100;

function clampZoomPercent(percent: number): number {
  return Math.min(
    MAX_ZOOM_PERCENT,
    Math.max(MIN_ZOOM_PERCENT, Math.round(percent)),
  );
}

export type CytoscapeGraphController = {
  containerRef: RefObject<HTMLDivElement | null>;
  zoomPercent: number;
  setZoomPercent: (percent: number) => void;
  fit: () => void;
  centerSelected: () => void;
  resetView: () => void;
  focusElement: (id: string) => void;
  runLayout: (name: LayoutName, target: LayoutTarget, fit: boolean) => void;
  getNeighborhoodIds: (ids: string[], depth?: number) => string[];
  cycleVisibleSelection: (step: 1 | -1, additive: boolean) => void;
  clearSelection: () => void;
  applyVisibility: (state: VisibilityState) => void;
};

type UseCytoscapeGraphOptions = {
  elements: ElementDefinition[];
  onSelectionChange: (ids: string[]) => void;
};

function updateSemanticLens(cy: Core): void {
  const selected = cy.$(":selected");
  cy.elements().removeClass("semantic-dim semantic-context");

  if (selected.empty()) {
    return;
  }

  const context = selected
    .union(selected.connectedEdges())
    .union(selected.connectedNodes())
    .union(selected.nodes().neighborhood());
  cy.elements().addClass("semantic-dim");
  context.removeClass("semantic-dim").addClass("semantic-context");
}

export function useCytoscapeGraph({
  elements,
  onSelectionChange,
}: UseCytoscapeGraphOptions): CytoscapeGraphController {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [zoomPercent, setZoomPercentState] = useState(DEFAULT_ZOOM_PERCENT);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: cytoscapeStyles,
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 64,
      },
      boxSelectionEnabled: true,
      selectionType: "additive",
      wheelSensitivity: 0.5,
      minZoom: MIN_ZOOM_PERCENT / 100,
      maxZoom: MAX_ZOOM_PERCENT / 100,
    });

    const emitSelection = () => {
      updateSemanticLens(cy);
      onSelectionChangeRef.current(cy.$(":selected").map((item) => item.id()));
    };
    const emitZoom = () => {
      setZoomPercentState(clampZoomPercent(cy.zoom() * 100));
    };
    const clearSelection = (event: cytoscape.EventObject) => {
      if (event.target === cy) {
        cy.$(":selected").unselect();
      }
    };

    cy.on("select unselect", "node, edge", emitSelection);
    cy.on("zoom", emitZoom);
    cy.on("tap", clearSelection);
    cyRef.current = cy;
    emitZoom();

    return () => {
      cyRef.current = null;
      cy.destroy();
    };
  }, [elements]);

  const setZoomPercent = useCallback((percent: number) => {
    const cy = cyRef.current;
    if (!cy) return;

    const nextPercent = clampZoomPercent(percent);
    cy.zoom({
      level: nextPercent / 100,
      renderedPosition: {
        x: cy.width() / 2,
        y: cy.height() / 2,
      },
    });
    setZoomPercentState(nextPercent);
  }, []);

  const fit = useCallback(() => {
    cyRef.current?.fit(cyRef.current.elements(":visible"), 56);
  }, []);

  const centerSelected = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const selected = cy.$(":selected");
    cy.center(selected.nonempty() ? selected : cy.elements(":visible"));
  }, []);

  const resetView = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.$(":selected").unselect();
    cy.fit(cy.elements(":visible"), 56);
  }, []);

  const focusElement = useCallback((id: string) => {
    const cy = cyRef.current;
    if (!cy) return;
    const element = cy.getElementById(id);
    if (element.empty()) return;
    element.style("display", "element");
    cy.$(":selected").unselect();
    element.select();
    cy.animate({ center: { eles: element }, zoom: 1.7, duration: 280 });
  }, []);

  const runLayout = useCallback(
    (name: LayoutName, target: LayoutTarget, shouldFit: boolean) => {
      const cy = cyRef.current;
      if (!cy) return;
      const collection =
        target === "selected"
          ? cy.$(":selected").union(cy.$(":selected").connectedEdges())
          : target === "visible"
            ? cy.elements(":visible")
            : cy.elements();

      if (collection.nodes().length < 2) {
        return;
      }

      const options = {
        name,
        animate: false,
        fit: shouldFit,
        padding: 56,
      } as LayoutOptions;
      collection.layout(options).run();
    },
    [],
  );

  const getNeighborhoodIds = useCallback((ids: string[], depth = 1) => {
    const cy = cyRef.current;
    if (!cy || ids.length === 0) return [];
    let collection = cy.collection();

    for (const id of ids) {
      collection = collection.union(cy.getElementById(id));
    }

    let expanded = collection.union(collection.edges().connectedNodes());
    for (let level = 0; level < depth; level += 1) {
      expanded = expanded.union(expanded.nodes().closedNeighborhood());
    }

    return expanded.map((element) => element.id());
  }, []);

  const cycleVisibleSelection = useCallback(
    (step: 1 | -1, additive: boolean) => {
      const cy = cyRef.current;
      if (!cy) return;
      const visible = cy.elements(":visible");
      if (visible.empty()) return;
      const visibleElements = visible.toArray();
      const selected = cy.$(":selected").last();
      const currentIndex = selected.nonempty()
        ? visibleElements.findIndex((element) => element.id() === selected.id())
        : step === 1
          ? -1
          : 0;
      const nextIndex =
        (currentIndex + step + visibleElements.length) % visibleElements.length;
      const next = visibleElements[nextIndex];

      if (!additive) cy.$(":selected").unselect();
      next.select();
      cy.center(next);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    cyRef.current?.$(":selected").unselect();
  }, []);

  const applyVisibility = useCallback((state: VisibilityState) => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().forEach((element) => {
        const data = element.data() as OntologyNodeData | OntologyEdgeData;
        const visible = isOntologyElementVisible(data, state);

        if (visible) {
          element.style("display", "element");
        } else {
          element.style("display", "none");
        }
      });
    });
  }, []);

  return useMemo(
    () => ({
      containerRef,
      zoomPercent,
      setZoomPercent,
      fit,
      centerSelected,
      resetView,
      focusElement,
      runLayout,
      getNeighborhoodIds,
      cycleVisibleSelection,
      clearSelection,
      applyVisibility,
    }),
    [
      applyVisibility,
      centerSelected,
      fit,
      focusElement,
      getNeighborhoodIds,
      cycleVisibleSelection,
      clearSelection,
      resetView,
      runLayout,
      setZoomPercent,
      zoomPercent,
    ],
  );
}
