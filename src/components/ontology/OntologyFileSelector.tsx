import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type SVGProps,
} from "react";
import type {
  OntologyTreeNode,
} from "../../services/ontology/ontologyTree";

export type OntologyFileSelectorProps = {
  tree: OntologyTreeNode[];
  activePath: string;
  pendingPath: string | null;
  loading: boolean;
  onSelect: (path: string) => Promise<boolean>;
};

function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <path d="M2.5 5.25A1.75 1.75 0 0 1 4.25 3.5h3.1l1.6 1.75h6.8A1.75 1.75 0 0 1 17.5 7v7.25A1.75 1.75 0 0 1 15.75 16H4.25a1.75 1.75 0 0 1-1.75-1.75v-9Z" />
    </svg>
  );
}

function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <path d="M5 2.75h6l4 4v10.5H5V2.75Z" />
      <path d="M11 2.75v4h4" />
      <path d="M7.5 10h5M7.5 12.75h5" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`ontology-source-selector__chevron${expanded ? " ontology-source-selector__chevron--expanded" : ""}`}
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path d="m4 2.5 3.5 3.5L4 9.5" />
    </svg>
  );
}

function getAncestorFolderPaths(path: string): string[] {
  const segments = path.split("/");
  segments.pop();
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

function formatActivePath(path: string): string {
  const segments = path.split("/");
  const fileName = segments.pop()?.replace(/\.ontology\.json$/i, "") ?? path;
  return [...segments, fileName].join(" / ");
}

type TreeBranchProps = {
  nodes: OntologyTreeNode[];
  activePath: string;
  pendingPath: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onChooseFile: (path: string) => void;
};

function TreeBranch({
  nodes,
  activePath,
  pendingPath,
  expandedFolders,
  onToggleFolder,
  onChooseFile,
}: TreeBranchProps) {
  return (
    <ul className="ontology-source-tree">
      {nodes.map((node) => {
        if (node.kind === "folder") {
          const expanded = expandedFolders.has(node.path);
          return (
            <li key={`folder:${node.path}`}>
              <button
                type="button"
                className="ontology-source-tree__row ontology-source-tree__folder"
                aria-expanded={expanded}
                onClick={() => onToggleFolder(node.path)}
              >
                <ChevronIcon expanded={expanded} />
                <FolderIcon className="ontology-source-tree__icon" />
                <span>{node.name}</span>
              </button>
              {expanded && (
                <TreeBranch
                  nodes={node.children}
                  activePath={activePath}
                  pendingPath={pendingPath}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  onChooseFile={onChooseFile}
                />
              )}
            </li>
          );
        }

        const active = node.relativePath === activePath;
        const pending = node.relativePath === pendingPath;
        return (
          <li key={`file:${node.relativePath}`}>
            <button
              type="button"
              className={`ontology-source-tree__row ontology-source-tree__file${active ? " ontology-source-tree__file--active" : ""}`}
              aria-current={active ? "true" : undefined}
              title={node.relativePath}
              onClick={() => onChooseFile(node.relativePath)}
            >
              <span className="ontology-source-tree__file-spacer" />
              <FileIcon className="ontology-source-tree__icon" />
              <span>{node.name}</span>
              {pending && <span className="ontology-source-tree__loading" aria-label="Loading" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function OntologyFileSelector({
  tree,
  activePath,
  pendingPath,
  loading,
  onSelect,
}: OntologyFileSelectorProps) {
  const popupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const initialFolders = useMemo(
    () => new Set(getAncestorFolderPaths(activePath)),
    [activePath],
  );
  const [expandedFolders, setExpandedFolders] = useState(initialFolders);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleFolder(path: string) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function chooseFile(path: string) {
    if (path === activePath) {
      setOpen(false);
      return;
    }

    if (await onSelect(path)) {
      setOpen(false);
    }
  }

  return (
    <div className="ontology-source-selector" ref={rootRef}>
      <span className="ontology-source-selector__label">Ontology</span>
      <button
        ref={triggerRef}
        type="button"
        className="ontology-source-selector__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        title={activePath}
        onClick={() => setOpen((current) => !current)}
      >
        <FileIcon className="ontology-source-selector__trigger-icon" />
        <span>{formatActivePath(activePath)}</span>
        {loading && <span className="ontology-source-tree__loading" aria-label="Loading ontology" />}
        <ChevronIcon expanded={open} />
      </button>

      {open && (
        <div
          id={popupId}
          className="ontology-source-selector__popup"
          role="dialog"
          aria-label="Ontology files"
        >
          <div className="ontology-source-selector__popup-header">
            <strong>Ontology files</strong>
            <span>Select a JSON source</span>
          </div>
          <div className="ontology-source-selector__scroll">
            <TreeBranch
              nodes={tree}
              activePath={activePath}
              pendingPath={pendingPath}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              onChooseFile={(path) => void chooseFile(path)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
