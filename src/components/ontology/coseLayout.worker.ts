import cytoscape, { type ElementDefinition } from "cytoscape";

type CoseLayoutRequest = {
  id: number;
  elements: ElementDefinition[];
};

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

self.onmessage = (event: MessageEvent<CoseLayoutRequest>) => {
  const { id, elements } = event.data;
  const startedAt = performance.now();
  try {
    const cy = cytoscape({
      headless: true,
      elements,
      styleEnabled: false,
      layout: { name: "preset" },
    });

    cy.layout({
      name: "cose",
      animate: false,
      fit: false,
      padding: 56,
    }).run();

    const positions = cy.nodes().map((node) => ({
      id: node.id(),
      x: node.position("x"),
      y: node.position("y"),
    }));
    cy.destroy();

    self.postMessage({
      id,
      type: "complete",
      positions,
      elapsedMs: performance.now() - startedAt,
    } satisfies CoseLayoutResponse);
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : "CoSE layout failed.",
      elapsedMs: performance.now() - startedAt,
    } satisfies CoseLayoutResponse);
  }
};
