import type { StylesheetJson } from "cytoscape";

export const cytoscapeStyles: StylesheetJson = [
  {
    selector: "node",
    style: {
      "background-color": "#147D84",
      "border-color": "#0D565D",
      "border-width": 2,
      color: "#18282E",
      "font-family": "Segoe UI, sans-serif",
      "font-size": 11,
      "font-weight": 600,
      height: 46,
      label: "data(label)",
      "min-zoomed-font-size": 10,
      "text-background-color": "#EDF3F4",
      "text-background-opacity": 0.92,
      "text-background-padding": "3px",
      "text-margin-y": 8,
      "text-valign": "bottom",
      width: 46,
    },
  },
  {
    selector: "node.external-node",
    style: {
      "background-color": "#D7E0E2",
      "border-color": "#718087",
      "border-style": "dashed",
      color: "#43565D",
      shape: "diamond",
    },
  },
  {
    selector: "node.property-node",
    style: {
      "background-color": "#F4D8B5",
      "border-color": "#C87923",
      color: "#71420E",
      height: 34,
      shape: "hexagon",
      width: 42,
    },
  },
  {
    selector: "edge",
    style: {
      "curve-style": "bezier",
      label: "data(label)",
      "font-family": "Cascadia Mono, Consolas, monospace",
      "font-size": 8,
      "min-zoomed-font-size": 10,
      "line-color": "#47747A",
      "line-opacity": 0.78,
      "target-arrow-color": "#47747A",
      "target-arrow-shape": "triangle",
      "text-background-color": "#EDF3F4",
      "text-background-opacity": 0.88,
      "text-background-padding": "2px",
      "text-rotation": "autorotate",
      width: 2,
    },
  },
  {
    selector: "edge.subclass-edge",
    style: {
      "line-color": "#7557D6",
      "line-style": "dashed",
      "target-arrow-color": "#7557D6",
      "target-arrow-shape": "triangle",
      width: 2.5,
    },
  },
  {
    selector: "edge.property-edge",
    style: {
      "line-color": "#C87923",
      "line-style": "dotted",
      "target-arrow-color": "#C87923",
      "target-arrow-shape": "vee",
      width: 2,
    },
  },
  {
    selector: ".semantic-dim",
    style: {
      opacity: 0.12,
      "text-opacity": 0.05,
    },
  },
  {
    selector: ".semantic-context",
    style: {
      opacity: 1,
      "text-opacity": 1,
    },
  },
  {
    selector: ":selected",
    style: {
      "border-color": "#18282E",
      "border-width": 5,
      "line-color": "#18282E",
      "target-arrow-color": "#18282E",
      "underlay-color": "#147D84",
      "underlay-opacity": 0.18,
      "underlay-padding": 10,
      "z-index": 99,
    },
  },
];
