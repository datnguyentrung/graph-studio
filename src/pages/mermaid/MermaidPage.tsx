import mermaid from "mermaid";
import { useEffect, useRef, useState, type FormEvent } from "react";
import svgPanZoom from "svg-pan-zoom";
import diagramCode from "../../../data/road.mmd?raw";

mermaid.initialize({
  startOnLoad: false,
});

type HighlightSelection = {
  nodes: string[];
  edges: Array<[string, string]>;
};

const NODE_PATTERN = "[A-Za-z_][A-Za-z0-9_]*";

/**
 * Input:
 * [N02_01, N03_03, DE03, N01_05, R2_C-R2_D]
 *
 * Node:
 * N02_01
 *
 * Edge:
 * R2_C-R2_D
 * hoặc:
 * R2_C->R2_D
 */
const INPUT_EDGE_REGEX = new RegExp(
  `^(${NODE_PATTERN})\\s*(?:->|-)\\s*(${NODE_PATTERN})$`,
);

/**
 * Hỗ trợ các cạnh đang xuất hiện trong road.mmd:
 *
 * A -->|"label"| B
 * A <-->|"label"| B
 */
const MERMAID_EDGE_REGEX = new RegExp(
  `^\\s*(${NODE_PATTERN})\\s*(<-->|-->)\\s*(?:\\|.*?\\|)?\\s*(${NODE_PATTERN})\\s*$`,
);

function canonicalEdgeKey(from: string, to: string): string {
  return [from, to].sort().join("::");
}

function parseHighlightInput(value: string): HighlightSelection {
  const cleaned = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  const nodes: string[] = [];
  const edges: Array<[string, string]> = [];

  for (const rawToken of cleaned.split(",")) {
    const token = rawToken.trim();

    if (!token) {
      continue;
    }

    const edgeMatch = token.match(INPUT_EDGE_REGEX);

    if (edgeMatch) {
      edges.push([edgeMatch[1], edgeMatch[2]]);
    } else {
      nodes.push(token);
    }
  }

  return {
    nodes: [...new Set(nodes)],
    edges,
  };
}

function buildHighlightedDiagram(
  source: string,
  highlightInput: string,
): string {
  const selection = parseHighlightInput(highlightInput);
  const selectedEdgeKeys = new Set(
    selection.edges.map(([from, to]) => canonicalEdgeKey(from, to)),
  );
  const highlightedLinkIndexes: number[] = [];
  let currentLinkIndex = 0;

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(MERMAID_EDGE_REGEX);

    if (!match) {
      continue;
    }

    const from = match[1];
    const to = match[3];

    if (selectedEdgeKeys.has(canonicalEdgeKey(from, to))) {
      highlightedLinkIndexes.push(currentLinkIndex);
    }

    currentLinkIndex += 1;
  }

  const styleLines: string[] = [
    `classDef routeHighlight fill:#fee2e2,stroke:#dc2626,stroke-width:6px,color:#7f1d1d,font-weight:bold;`,
  ];

  if (selection.nodes.length > 0) {
    styleLines.push(`class ${selection.nodes.join(",")} routeHighlight;`);
  }

  if (highlightedLinkIndexes.length > 0) {
    styleLines.push(
      `linkStyle ${highlightedLinkIndexes.join(
        ",",
      )} stroke:#dc2626,stroke-width:7px,color:#b91c1c;`,
    );
  }

  return `${source}\n${styleLines.join("\n")}`;
}

function MermaidPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<ReturnType<typeof svgPanZoom> | null>(null);
  const defaultHighlight = "[N02_01]";
  const [highlightInput, setHighlightInput] = useState(defaultHighlight);
  const [appliedHighlight, setAppliedHighlight] = useState(defaultHighlight);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        panZoomRef.current?.destroy();
        panZoomRef.current = null;

        const highlightedDiagram = buildHighlightedDiagram(
          diagramCode,
          appliedHighlight,
        );
        const renderId = `mermaid-${crypto.randomUUID()}`;
        const { svg, bindFunctions } = await mermaid.render(
          renderId,
          highlightedDiagram,
        );

        if (cancelled || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = svg;
        bindFunctions?.(containerRef.current);

        const svgElement =
          containerRef.current.querySelector<SVGSVGElement>("svg");

        if (!svgElement) {
          throw new Error("Không tìm thấy SVG được Mermaid tạo ra.");
        }

        svgElement.style.width = "100%";
        svgElement.style.height = "100%";
        svgElement.style.maxWidth = "none";
        svgElement.style.display = "block";

        const highlightStyle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "style",
        );

        highlightStyle.textContent = `
          .routeHighlight > rect,
          .routeHighlight > circle,
          .routeHighlight > ellipse,
          .routeHighlight > polygon,
          .routeHighlight > path {
            filter: drop-shadow(
              0 0 8px rgba(220, 38, 38, 0.95)
            );
          }

          .routeHighlight .nodeLabel {
            font-weight: 800 !important;
          }
        `;

        svgElement.prepend(highlightStyle);

        panZoomRef.current = svgPanZoom(svgElement, {
          panEnabled: true,
          zoomEnabled: true,
          controlIconsEnabled: true,
          mouseWheelZoomEnabled: true,
          dblClickZoomEnabled: true,
          zoomScaleSensitivity: 0.25,
          minZoom: 0.05,
          maxZoom: 100,
          fit: true,
          center: true,
        });

        setError("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không render được sơ đồ.",
        );
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
      panZoomRef.current?.destroy();
      panZoomRef.current = null;
    };
  }, [appliedHighlight]);

  function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedHighlight(highlightInput);
  }

  function handleClear() {
    setHighlightInput("");
    setAppliedHighlight("");
  }

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        margin: 0,
        overflow: "hidden",
      }}
    >
      <h2 style={{ margin: "12px 16px 8px" }}>Navigation Graph</h2>

      <form
        onSubmit={handleApply}
        style={{ display: "flex", gap: 8, margin: "0 16px 12px" }}
      >
        <input
          value={highlightInput}
          onChange={(event) => setHighlightInput(event.target.value)}
          placeholder="[N02_01, N03_03, R2_C-R2_D]"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px 10px",
            border: "1px solid #aaa",
            borderRadius: 6,
          }}
        />

        <button type="submit">Highlight</button>
        <button type="button" onClick={handleClear}>
          Clear
        </button>
      </form>

      <div style={{ margin: "0 16px 10px", fontSize: 13, color: "#555" }}>
        Node: <code>N02_01</code>. Cạnh: <code>N02_01-N03_01</code>.
      </div>

      {error && (
        <pre
          style={{
            color: "red",
            whiteSpace: "pre-wrap",
            margin: "0 16px 12px",
          }}
        >
          {error}
        </pre>
      )}

      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflow: "hidden",
          borderTop: "1px solid #ccc",
          cursor: "grab",
        }}
      />
    </main>
  );
}

export default MermaidPage;
