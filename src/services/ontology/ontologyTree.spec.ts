import { describe, expect, it } from "vitest";
import { buildOntologyTree } from "./ontologyTree";

describe("buildOntologyTree", () => {
  it("preserves nested folders and root files", () => {
    expect(
      buildOntologyTree([
        "all.ontology.json",
        "LOAN/LoansSpecific/ConsumerLoans.ontology.json",
        "LOAN/LoansSpecific/CommercialLoans.ontology.json",
        "CARD/CardAccounts.ontology.json",
      ]),
    ).toEqual([
      {
        kind: "folder",
        name: "CARD",
        path: "CARD",
        children: [
          {
            kind: "file",
            name: "CardAccounts.ontology.json",
            relativePath: "CARD/CardAccounts.ontology.json",
          },
        ],
      },
      {
        kind: "folder",
        name: "LOAN",
        path: "LOAN",
        children: [
          {
            kind: "folder",
            name: "LoansSpecific",
            path: "LOAN/LoansSpecific",
            children: [
              {
                kind: "file",
                name: "CommercialLoans.ontology.json",
                relativePath:
                  "LOAN/LoansSpecific/CommercialLoans.ontology.json",
              },
              {
                kind: "file",
                name: "ConsumerLoans.ontology.json",
                relativePath:
                  "LOAN/LoansSpecific/ConsumerLoans.ontology.json",
              },
            ],
          },
        ],
      },
      {
        kind: "file",
        name: "all.ontology.json",
        relativePath: "all.ontology.json",
      },
    ]);
  });

  it("sorts numeric folder and file names naturally", () => {
    const tree = buildOntologyTree([
      "Group10/File10.ontology.json",
      "Group2/File10.ontology.json",
      "Group2/File2.ontology.json",
    ]);

    expect(tree.map((node) => node.name)).toEqual(["Group2", "Group10"]);
    const firstFolder = tree[0];
    expect(firstFolder.kind).toBe("folder");
    if (firstFolder.kind === "folder") {
      expect(firstFolder.children.map((node) => node.name)).toEqual([
        "File2.ontology.json",
        "File10.ontology.json",
      ]);
    }
  });
});

