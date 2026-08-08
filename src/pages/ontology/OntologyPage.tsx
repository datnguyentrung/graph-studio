import { useMemo } from "react";
import { OntologyExplorer } from "../../components/ontology/OntologyExplorer";
import { convertToCytoscapeElements } from "../../services/ontology/convertToCytoscapeElements";
import {
  loadDefaultOntology,
  ontologySources,
} from "../../services/ontology/ontologyRegistry";
import type { RoutePageProps } from "../../routes/routeConfig";
import "./ontology.css";

function OntologyPage({ subPath }: RoutePageProps) {
  const result = useMemo(() => {
    try {
      const document = loadDefaultOntology();
      return {
        document,
        model: convertToCytoscapeElements(document),
        error: "",
      };
    } catch (error) {
      return {
        document: null,
        model: null,
        error:
          error instanceof Error
            ? error.message
            : "The ontology source could not be loaded.",
      };
    }
  }, []);

  if (!result.document || !result.model) {
    return (
      <main className="ontology-page ontology-page--error">
        <span className="ontology-eyebrow">Data source error</span>
        <h1>Ontology Explorer could not start</h1>
        <p>{result.error}</p>
        <a href="/mermaid">Open the Mermaid page</a>
      </main>
    );
  }

  return (
    <OntologyExplorer
      document={result.document}
      model={result.model}
      sourceLabel={ontologySources[0]?.label ?? "Ontology"}
      subPath={subPath}
    />
  );
}

export default OntologyPage;
