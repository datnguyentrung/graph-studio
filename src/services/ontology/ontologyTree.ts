export type OntologyFolderNode = {
  kind: "folder";
  name: string;
  path: string;
  children: OntologyTreeNode[];
};

export type OntologyFileNode = {
  kind: "file";
  name: string;
  relativePath: string;
};

export type OntologyTreeNode = OntologyFolderNode | OntologyFileNode;

type MutableFolderNode = Omit<OntologyFolderNode, "children"> & {
  children: Array<MutableFolderNode | OntologyFileNode>;
};

const ontologyNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function sortTree(nodes: Array<MutableFolderNode | OntologyFileNode>): void {
  nodes.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "folder" ? -1 : 1;
    }

    return ontologyNameCollator.compare(left.name, right.name);
  });

  for (const node of nodes) {
    if (node.kind === "folder") {
      sortTree(node.children);
    }
  }
}

export function buildOntologyTree(paths: readonly string[]): OntologyTreeNode[] {
  const root: Array<MutableFolderNode | OntologyFileNode> = [];

  for (const relativePath of paths) {
    const segments = relativePath.split("/").filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) continue;

    let children = root;
    let folderPath = "";

    for (const segment of segments) {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      let folder = children.find(
        (node): node is MutableFolderNode =>
          node.kind === "folder" && node.name === segment,
      );

      if (!folder) {
        folder = {
          kind: "folder",
          name: segment,
          path: folderPath,
          children: [],
        };
        children.push(folder);
      }

      children = folder.children;
    }

    children.push({ kind: "file", name: fileName, relativePath });
  }

  sortTree(root);
  return root;
}

