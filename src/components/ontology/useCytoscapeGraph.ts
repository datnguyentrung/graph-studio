import type {
  Core,
  ElementDefinition,
  EventObject,
  LayoutOptions,
} from "cytoscape";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  canRunOntologyLayout,
  chooseAutomaticOntologyLayout,
  countOntologyNodes,
  isOntologyEdgeDefinition,
  type OntologyLayoutName,
} from "../../services/ontology/ontologyLayoutPolicy";
import { cytoscapeStyles } from "./cytoscapeStyles";

export type LayoutName = OntologyLayoutName;
export type LayoutTarget = "current" | "selected";
export type GraphRuntimeStatus =
  | "loading-data"
  | "building-model"
  | "mounting-graph"
  | "processing-layout"
  | "layouting"
  | "ready"
  | "error";

export const MIN_ZOOM_PERCENT = 50;
export const MAX_ZOOM_PERCENT = 500;
const DEFAULT_ZOOM_PERCENT = 100;
const GRAPH_MOUNT_CHUNK_SIZE = 512;
const LARGE_GRAPH_OVERVIEW_ZOOM = 0.85;

type CoseLayoutResponse =
  | {
      id: number;
      type: "complete";
      positions: Array<{ id: string; x: number; y: number }>;
      elapsedMs: number;
    }
  | {
      id: number;
      type: "error";
      message: string;
      elapsedMs: number;
    };

function clampZoomPercent(percent: number): number {
  return Math.min(
    MAX_ZOOM_PERCENT,
    Math.max(MIN_ZOOM_PERCENT, Math.round(percent)),
  );
}

function definitionId(element: ElementDefinition): string {
  return String(element.data.id);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function keepReadableViewport(cy: Core): void {
  const elements = cy.elements();
  if (elements.empty()) return;
  cy.center(elements);
  cy.zoom({
    level: LARGE_GRAPH_OVERVIEW_ZOOM,
    renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
  });
}

function updateSemanticLens(cy: Core): void {
  const selected = cy.$(":selected");
  cy.elements().removeClass("semantic-dim semantic-context");

  if (selected.empty()) return;
  const context = selected
    .union(selected.connectedEdges())
    .union(selected.connectedNodes())
    .union(selected.nodes().neighborhood());
  cy.elements().addClass("semantic-dim");
  context.removeClass("semantic-dim").addClass("semantic-context");
}

export type CytoscapeGraphController = {
  containerRef: RefObject<HTMLDivElement | null>;
  status: GraphRuntimeStatus;
  statusMessage: string;
  zoomPercent: number;
  nodeCount: number;
  mountedElementCount: number;
  totalElementCount: number;
  layoutElapsedMs: number;
  canRunCose: boolean;
  setZoomPercent: (percent: number) => void;
  fit: () => void;
  centerSelected: () => void;
  resetView: () => void;
  focusElement: (id: string) => void;
  runLayout: (name: LayoutName, target: LayoutTarget, fit: boolean) => boolean;
  cancelLayout: () => void;
  cycleVisibleSelection: (step: 1 | -1, additive: boolean) => void;
  clearSelection: () => void;
};

type UseCytoscapeGraphOptions = {
  elements: ElementDefinition[];
  onSelectionChange: (ids: string[]) => void;
};

export function useCytoscapeGraph({
  elements,
  onSelectionChange,
}: UseCytoscapeGraphOptions): CytoscapeGraphController {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const elementsRef = useRef(elements);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const layoutFrameRef = useRef<number | null>(null);
  const layoutRequestRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const layoutStartedAtRef = useRef(0);
  const [zoomPercent, setZoomPercentState] = useState(DEFAULT_ZOOM_PERCENT);
  const [status, setStatus] = useState<GraphRuntimeStatus>("loading-data");
  const [statusMessage, setStatusMessage] = useState("Loading graph engine...");
  const [mountedElementCount, setMountedElementCount] = useState(0);
  const [totalElementCount, setTotalElementCount] = useState(elements.length);
  const [layoutElapsedMs, setLayoutElapsedMs] = useState(0);

  const nodeCount = useMemo(
    () => countOntologyNodes(elements),
    [elements],
  );
  const canRunCose = canRunOntologyLayout("cose", nodeCount);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const cancelLayout = useCallback(() => {
    layoutRequestRef.current += 1;
    if (layoutFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutFrameRef.current);
      layoutFrameRef.current = null;
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus("ready");
    setStatusMessage("CoSE layout cancelled. The graph remains usable.");
  }, []);

  const runDirectLayout = useCallback((
    cy: Core,
    name: LayoutName,
    target: LayoutTarget,
    shouldFit: boolean,
    requestId: number,
  ) => {
    if (layoutFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutFrameRef.current);
    }

    setStatus("layouting");
    setStatusMessage("Arranging current view...");
    layoutFrameRef.current = window.requestAnimationFrame(() => {
      layoutFrameRef.current = window.requestAnimationFrame(() => {
        if (requestId !== layoutRequestRef.current || cy.destroyed()) return;
        const collection = target === "selected"
          ? cy.$(":selected").union(cy.$(":selected").connectedEdges())
          : cy.elements();
        if (collection.nodes().length < 2) {
          setStatus("ready");
          setStatusMessage("");
          return;
        }

        try {
          performance.mark("ontology:layout-start");
          const options = {
            name,
            animate: false,
            fit: shouldFit,
            padding: 56,
            ...(name === "breadthfirst"
              ? { directed: true, direction: "downward", spacingFactor: 1.35 }
              : {}),
          } as LayoutOptions;
          collection.layout(options).run();
          performance.mark("ontology:layout-complete");
          performance.measure(
            "ontology:layout",
            "ontology:layout-start",
            "ontology:layout-complete",
          );
          setStatus("ready");
          setStatusMessage("");
        } catch (error) {
          setStatus("error");
          setStatusMessage(
            error instanceof Error ? error.message : "The graph layout failed.",
          );
        }
      });
    });
  }, []);

  const runCoseWorkerLayout = useCallback((
    cy: Core,
    target: LayoutTarget,
    shouldFit: boolean,
    requestId: number,
  ) => {
    workerRef.current?.terminate();
    const collection = target === "selected"
      ? cy.$(":selected").union(cy.$(":selected").connectedEdges())
      : cy.elements();
    if (collection.nodes().length < 2) {
      setStatus("ready");
      setStatusMessage("");
      return;
    }

    try {
      collection.layout({
        name: "grid",
        animate: false,
        fit: false,
        padding: 160,
      }).run();
      if (shouldFit && target === "selected") {
        cy.fit(collection, 80);
      } else {
        keepReadableViewport(cy);
      }
    } catch {
      // The worker layout is the authoritative CoSE pass; grid is only a fast fallback.
    }
    const worker = new Worker(new URL("./coseLayout.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    layoutStartedAtRef.current = performance.now();
    setLayoutElapsedMs(0);
    setStatus("processing-layout");
    setStatusMessage(
      `Processing CoSE layout for ${collection.nodes().length.toLocaleString()} nodes...`,
    );

    worker.onmessage = (event: MessageEvent<CoseLayoutResponse>) => {
      const response = event.data;
      if (response.id !== requestId || workerRef.current !== worker || cy.destroyed()) {
        worker.terminate();
        return;
      }
      worker.terminate();
      workerRef.current = null;
      setLayoutElapsedMs(Math.round(response.elapsedMs));

      if (response.type === "error") {
        setStatus("error");
        setStatusMessage(
          `${response.message} The graph is still available in fallback layout.`,
        );
        return;
      }

      cy.batch(() => {
        for (const position of response.positions) {
          const node = cy.getElementById(position.id);
          if (node.nonempty()) node.position({ x: position.x, y: position.y });
        }
      });
      if (shouldFit && target === "selected") {
        cy.fit(collection, 80);
      } else {
        keepReadableViewport(cy);
      }
      setZoomPercentState(clampZoomPercent(cy.zoom() * 100));
      performance.mark("ontology:layout-complete");
      setStatus("ready");
      setStatusMessage(
        `CoSE layout complete in ${Math.round(response.elapsedMs).toLocaleString()} ms. Full graph stays zoomed out for readable spacing; use Fit graph if you want to see every node at once.`,
      );
    };
    worker.onerror = () => {
      if (workerRef.current !== worker) return;
      worker.terminate();
      workerRef.current = null;
      setStatus("error");
      setStatusMessage("CoSE layout worker failed. The fallback layout remains usable.");
    };
    worker.postMessage({
      id: requestId,
      elements: collection.jsons() as ElementDefinition[],
    });
  }, []);

  const scheduleLayout = useCallback((
    cy: Core,
    name: LayoutName,
    target: LayoutTarget,
    shouldFit: boolean,
  ) => {
    layoutRequestRef.current += 1;
    const requestId = layoutRequestRef.current;
    workerRef.current?.terminate();
    workerRef.current = null;

    if (name === "cose") {
      runCoseWorkerLayout(cy, target, shouldFit, requestId);
      return;
    }
    runDirectLayout(cy, name, target, shouldFit, requestId);
  }, [runCoseWorkerLayout, runDirectLayout]);

  const syncProjection = useCallback(async (
    cy: Core,
    nextElements: ElementDefinition[],
    requestId: number,
  ) => {
    const nextIds = new Set(nextElements.map(definitionId));
    const nodesToAdd = nextElements.filter(
      (element) =>
        !isOntologyEdgeDefinition(element) &&
        cy.getElementById(definitionId(element)).empty(),
    );
    const edgesToAdd = nextElements.filter(
      (element) =>
        isOntologyEdgeDefinition(element) &&
        cy.getElementById(definitionId(element)).empty(),
    );
    const addQueue = [...nodesToAdd, ...edgesToAdd];

    setStatus("mounting-graph");
    setTotalElementCount(nextElements.length);
    setStatusMessage(
      `Mounted ${cy.elements().length.toLocaleString()} / ${nextElements.length.toLocaleString()} elements`,
    );

    cy.batch(() => {
      cy.elements().forEach((element) => {
        if (!nextIds.has(element.id())) element.remove();
      });
    });

    for (let index = 0; index < addQueue.length; index += GRAPH_MOUNT_CHUNK_SIZE) {
      if (requestId !== layoutRequestRef.current || cy.destroyed()) return false;
      cy.batch(() => {
        cy.add(addQueue.slice(index, index + GRAPH_MOUNT_CHUNK_SIZE));
      });
      setMountedElementCount(cy.elements().length);
      setStatusMessage(
        `Mounted ${cy.elements().length.toLocaleString()} / ${nextElements.length.toLocaleString()} elements`,
      );
      await nextFrame();
    }

    setMountedElementCount(cy.elements().length);
    performance.mark("ontology:graph-elements-ready");
    return true;
  }, []);

  useEffect(() => {
    if (status !== "processing-layout") return;
    const timer = window.setInterval(() => {
      setLayoutElapsedMs(Math.round(performance.now() - layoutStartedAtRef.current));
    }, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let localCore: Core | null = null;

    performance.mark("ontology:graph-engine-load-start");
    setStatus("loading-data");
    setStatusMessage("Loading graph engine...");
    void import("cytoscape")
      .then(async ({ default: cytoscape }) => {
        if (cancelled || !containerRef.current) return;
        const cy = cytoscape({
          container: containerRef.current,
          elements: [],
          style: cytoscapeStyles,
          layout: { name: "preset" },
          boxSelectionEnabled: true,
          selectionType: "additive",
          minZoom: MIN_ZOOM_PERCENT / 100,
          maxZoom: MAX_ZOOM_PERCENT / 100,
        });
        localCore = cy;

        const emitSelection = () => {
          updateSemanticLens(cy);
          onSelectionChangeRef.current(
            cy.$(":selected").map((item) => item.id()),
          );
        };
        const emitZoom = () => {
          setZoomPercentState(clampZoomPercent(cy.zoom() * 100));
        };
        const clearSelection = (event: EventObject) => {
          if (event.target === cy) cy.$(":selected").unselect();
        };

        cy.on("select unselect", "node, edge", emitSelection);
        cy.on("zoom", emitZoom);
        cy.on("tap", clearSelection);
        cyRef.current = cy;
        performance.mark("ontology:graph-engine-ready");
        layoutRequestRef.current += 1;
        const requestId = layoutRequestRef.current;
        const mounted = await syncProjection(cy, elementsRef.current, requestId);
        if (cancelled || !mounted) return;
        emitZoom();
        scheduleLayout(
          cy,
          chooseAutomaticOntologyLayout(elementsRef.current),
          "current",
          true,
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setStatusMessage(
          error instanceof Error ? error.message : "The graph engine failed to load.",
        );
      });

    return () => {
      cancelled = true;
      layoutRequestRef.current += 1;
      if (layoutFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
      }
      workerRef.current?.terminate();
      workerRef.current = null;
      if (cyRef.current === localCore) cyRef.current = null;
      localCore?.destroy();
    };
  }, [scheduleLayout, syncProjection]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    layoutRequestRef.current += 1;
    const requestId = layoutRequestRef.current;
    void syncProjection(cy, elements, requestId).then((mounted) => {
      if (!mounted || requestId !== layoutRequestRef.current || cy.destroyed()) return;
      scheduleLayout(cy, chooseAutomaticOntologyLayout(elements), "current", true);
    });
  }, [elements, scheduleLayout, syncProjection]);

  const setZoomPercent = useCallback((percent: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    const nextPercent = clampZoomPercent(percent);
    cy.zoom({
      level: nextPercent / 100,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
    setZoomPercentState(nextPercent);
  }, []);

  const fit = useCallback(() => {
    const cy = cyRef.current;
    if (cy) cy.fit(cy.elements(), 56);
  }, []);

  const centerSelected = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const selected = cy.$(":selected");
    cy.center(selected.nonempty() ? selected : cy.elements());
  }, []);

  const resetView = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.$(":selected").unselect();
    cy.fit(cy.elements(), 56);
  }, []);

  const focusElement = useCallback((id: string) => {
    const cy = cyRef.current;
    if (!cy) return;
    const element = cy.getElementById(id);
    if (element.empty()) return;
    cy.$(":selected").unselect();
    element.select();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      cy.center(element);
      cy.zoom(1.7);
    } else {
      cy.animate({ center: { eles: element }, zoom: 1.7, duration: 280 });
    }
  }, []);

  const runLayout = useCallback((
    name: LayoutName,
    target: LayoutTarget,
    shouldFit: boolean,
  ): boolean => {
    const cy = cyRef.current;
    if (!cy) return false;
    const targetNodeCount = target === "selected"
      ? cy.$(":selected").nodes().length
      : cy.nodes().length;
    if (!canRunOntologyLayout(name, targetNodeCount)) return false;
    scheduleLayout(cy, name, target, shouldFit);
    return true;
  }, [scheduleLayout]);

  const cycleVisibleSelection = useCallback(
    (step: 1 | -1, additive: boolean) => {
      const cy = cyRef.current;
      if (!cy) return;
      const visibleNodes = cy.nodes(":visible");
      if (visibleNodes.empty()) return;
      const nodes = visibleNodes.toArray();
      const selected = cy.$(":selected").nodes().last();
      const currentIndex = selected.nonempty()
        ? nodes.findIndex((element) => element.id() === selected.id())
        : step === 1 ? -1 : 0;
      const next = nodes[(currentIndex + step + nodes.length) % nodes.length];
      if (!additive) cy.$(":selected").unselect();
      next.select();
      cy.center(next);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    cyRef.current?.$(":selected").unselect();
  }, []);

  return useMemo(
    () => ({
      containerRef,
      status,
      statusMessage,
      zoomPercent,
      nodeCount,
      mountedElementCount,
      totalElementCount,
      layoutElapsedMs,
      canRunCose,
      setZoomPercent,
      fit,
      centerSelected,
      resetView,
      focusElement,
      runLayout,
      cancelLayout,
      cycleVisibleSelection,
      clearSelection,
    }),
    [
      canRunCose,
      cancelLayout,
      centerSelected,
      clearSelection,
      cycleVisibleSelection,
      fit,
      focusElement,
      layoutElapsedMs,
      mountedElementCount,
      nodeCount,
      resetView,
      runLayout,
      setZoomPercent,
      status,
      statusMessage,
      totalElementCount,
      zoomPercent,
    ],
  );
}
