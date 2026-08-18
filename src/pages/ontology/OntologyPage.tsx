import { useCallback, useEffect, useMemo, useState } from "react";
import { OntologyExplorer } from "../../components/ontology/OntologyExplorer";
import { convertToCytoscapeElements } from "../../services/ontology/convertToCytoscapeElements";
import {
  getDefaultOntologyPath,
  getOntologyPaths,
  loadOntology,
} from "../../services/ontology/ontologyRegistry";
import {
  buildOntologySourceUrl,
  clearOntologySelection,
  createLatestRequestGuard,
  persistOntologySelection,
  resolveOntologySelection,
  type OntologySelectionStorage,
} from "../../services/ontology/ontologySelection";
import { buildOntologyTree } from "../../services/ontology/ontologyTree";
import type {
  CytoscapeGraphModel,
  OntologyDocument,
} from "../../services/ontology/types";
import type { RoutePageProps } from "../../routes/routeConfig";
import "./ontology.css";

type LoadedOntology = {
  document: OntologyDocument;
  model: CytoscapeGraphModel;
};

type LoadResult = "success" | "error" | "stale";

function invalidOntologySourceMessage(path: string): string {
  return `Ontology source was not found: ${path}`;
}

function getBrowserStorage(): OntologySelectionStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function OntologyPage({ subPath, search }: RoutePageProps) {
  const ontologyTree = useMemo(
    () => buildOntologyTree(getOntologyPaths()),
    [],
  );
  const requestGuard = useMemo(() => createLatestRequestGuard(), []);
  const [loadedOntology, setLoadedOntology] = useState<LoadedOntology | null>(
    null,
  );
  const [activeOntologyPath, setActiveOntologyPath] = useState("");
  const [pendingOntologyPath, setPendingOntologyPath] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadPath = useCallback(async (
    path: string,
    persistSelection: boolean,
  ): Promise<LoadResult> => {
    const requestId = requestGuard.begin();
    setPendingOntologyPath(path);
    setLoading(true);
    setLoadError("");

    try {
      performance.mark("ontology:data-load-start");
      const document = await loadOntology(path);
      performance.mark("ontology:data-loaded");
      if (!requestGuard.isLatest(requestId)) return "stale";
      const model = convertToCytoscapeElements(document);
      performance.mark("ontology:model-ready");
      performance.measure(
        "ontology:data-load",
        "ontology:data-load-start",
        "ontology:data-loaded",
      );
      performance.measure(
        "ontology:model-build",
        "ontology:data-loaded",
        "ontology:model-ready",
      );
      if (!requestGuard.isLatest(requestId)) return "stale";

      setLoadedOntology({ document, model });
      setActiveOntologyPath(path);
      if (persistSelection) {
        persistOntologySelection(getBrowserStorage(), path);
      }
      return "success";
    } catch (error) {
      if (!requestGuard.isLatest(requestId)) return "stale";
      setLoadError(
        error instanceof Error
          ? error.message
          : `The ontology source could not be loaded: ${path}`,
      );
      return "error";
    } finally {
      if (requestGuard.isLatest(requestId)) {
        setPendingOntologyPath(null);
        setLoading(false);
      }
    }
  }, [requestGuard]);

  useEffect(() => {
    const storage = getBrowserStorage();
    const selection = resolveOntologySelection(storage, search);
    const initialPath = selection.path;
    const defaultPath = getDefaultOntologyPath();

    if (initialPath === activeOntologyPath) {
      const syncTimer = window.setTimeout(() => {
        setLoadError(
          selection.invalidSourcePath
            ? invalidOntologySourceMessage(selection.invalidSourcePath)
            : "",
        );
      }, 0);
      return () => window.clearTimeout(syncTimer);
    }

    const startupTimer = window.setTimeout(() => {
      void loadPath(initialPath, true).then(async (result) => {
        if (result === "success" && selection.invalidSourcePath) {
          setLoadError(invalidOntologySourceMessage(selection.invalidSourcePath));
        }
        if (result === "error" && initialPath !== defaultPath) {
          clearOntologySelection(storage);
          await loadPath(defaultPath, true);
          if (selection.invalidSourcePath) {
            setLoadError(
              invalidOntologySourceMessage(selection.invalidSourcePath),
            );
          }
        }
      });
    }, 0);

    return () => window.clearTimeout(startupTimer);
  }, [activeOntologyPath, loadPath, search]);

  const handleOntologySelect = useCallback(
    async (path: string): Promise<boolean> => {
      if (path === activeOntologyPath) return true;
      const result = await loadPath(path, true);
      if (result === "success") {
        window.history.pushState(
          null,
          "",
          buildOntologySourceUrl(
            window.location.pathname,
            window.location.search,
            path,
          ),
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      return result === "success";
    },
    [activeOntologyPath, loadPath],
  );
  const ontologySelector = useMemo(
    () => ({
      tree: ontologyTree,
      activePath: activeOntologyPath,
      pendingPath: pendingOntologyPath,
      loading,
      onSelect: handleOntologySelect,
    }),
    [
      activeOntologyPath,
      handleOntologySelect,
      loading,
      ontologyTree,
      pendingOntologyPath,
    ],
  );

  if (!loadedOntology) {
    if (loading) {
      return (
        <main className="ontology-page ontology-page--loading" aria-live="polite">
          <span className="ontology-source-tree__loading" />
          <p>Loading ontology…</p>
        </main>
      );
    }

    return (
      <main className="ontology-page ontology-page--error">
        <span className="ontology-eyebrow">Data source error</span>
        <h1>Ontology Explorer could not start</h1>
        <p>{loadError}</p>
        <a href="/mermaid">Open the Mermaid page</a>
      </main>
    );
  }

  return (
    <OntologyExplorer
      key={activeOntologyPath}
      document={loadedOntology.document}
      model={loadedOntology.model}
      sourceLabel={activeOntologyPath}
      ontologySelector={ontologySelector}
      ontologyLoadError={loadError}
      subPath={subPath}
    />
  );
}

export default OntologyPage;
