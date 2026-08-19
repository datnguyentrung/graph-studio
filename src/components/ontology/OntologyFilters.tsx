import type {
  OntologyFacets,
  OntologyNodeData,
} from "../../services/ontology/types";
import type { OntologyFilterState } from "../../services/ontology/visibilityTypes";

type OntologyFiltersProps = {
  facets: OntologyFacets;
  filters: OntologyFilterState;
  onFiltersChange: (filters: OntologyFilterState) => void;
  onReset: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: OntologyNodeData[];
  onChooseSearchResult: (id: string) => void;
};

type ToggleKey =
  | "showNodes"
  | "showEdges"
  | "showProperties"
  | "showParentRelations";

const MAIN_TOGGLES: Array<{ key: ToggleKey; label: string }> = [
  { key: "showNodes", label: "Nodes" },
  { key: "showEdges", label: "Edges" },
  { key: "showProperties", label: "Properties" },
  { key: "showParentRelations", label: "Parent relations" },
];

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ontology-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function OntologyFilters({
  facets,
  filters,
  onFiltersChange,
  onReset,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onChooseSearchResult,
}: OntologyFiltersProps) {
  function toggleSet<T extends string>(
    source: Set<T>,
    value: T,
    checked: boolean,
  ): Set<T> {
    const next = new Set(source);
    if (checked) next.add(value);
    else next.delete(value);
    return next;
  }

  return (
    <aside
      id="ontology-filters-panel"
      className="ontology-panel ontology-filters"
      aria-label="Graph filters"
    >
      <div className="ontology-panel__heading">
        <div>
          <span className="ontology-eyebrow">Find & shape</span>
          <h2>Semantic lens</h2>
        </div>
        <button type="button" className="ontology-link-button" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="ontology-search">
        <label htmlFor="ontology-search">Search concepts</label>
        <input
          id="ontology-search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Name, label, technical name, IRI…"
          autoComplete="off"
        />
        {searchQuery.trim() && (
          <div className="ontology-search__results" aria-live="polite">
            {searchResults.length > 0 ? (
              searchResults.slice(0, 12).map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => onChooseSearchResult(result.id)}
                >
                  <strong>{result.label}</strong>
                  <span>{result.technicalName ?? result.iri ?? result.nodeType}</span>
                </button>
              ))
            ) : (
              <p>No matching concepts.</p>
            )}
          </div>
        )}
      </div>

      <fieldset className="ontology-filter-group">
        <legend>Visibility</legend>
        <div className="ontology-toggle-grid">
          {MAIN_TOGGLES.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={filters[key]}
              onChange={(checked) =>
                onFiltersChange({ ...filters, [key]: checked })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="ontology-filter-group">
        <legend>Scope</legend>
        <div className="ontology-toggle-grid">
          {facets.scopes.map((scope) => (
            <Toggle
              key={scope}
              label={`${scope[0].toUpperCase()}${scope.slice(1)} nodes`}
              checked={filters.enabledScopes.has(scope)}
              onChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  enabledScopes: toggleSet(
                    filters.enabledScopes,
                    scope,
                    checked,
                  ),
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="ontology-filter-group">
        <legend>Node types</legend>
        <div className="ontology-chip-list">
          {facets.nodeTypes.map((nodeType) => (
            <Toggle
              key={nodeType}
              label={nodeType}
              checked={filters.enabledNodeTypes.has(nodeType)}
              onChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  enabledNodeTypes: toggleSet(
                    filters.enabledNodeTypes,
                    nodeType,
                    checked,
                  ),
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="ontology-filter-group">
        <legend>Edge types</legend>
        <div className="ontology-chip-list">
          {facets.edgeTypes.map((edgeType) => (
            <Toggle
              key={edgeType}
              label={edgeType}
              checked={filters.enabledEdgeTypes.has(edgeType)}
              onChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  enabledEdgeTypes: toggleSet(
                    filters.enabledEdgeTypes,
                    edgeType,
                    checked,
                  ),
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="ontology-filter-group">
        <legend>Namespaces</legend>
        <div className="ontology-chip-list ontology-chip-list--scroll">
          {facets.namespaces.map((namespace) => (
            <Toggle
              key={namespace}
              label={namespace}
              checked={filters.enabledNamespaces.has(namespace)}
              onChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  enabledNamespaces: toggleSet(
                    filters.enabledNamespaces,
                    namespace,
                    checked,
                  ),
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="ontology-filter-group">
        <legend>Ontology groups</legend>
        <div className="ontology-chip-list">
          {facets.ontologyGroups.map((group) => (
            <Toggle
              key={group}
              label={group}
              checked={filters.enabledOntologyGroups.has(group)}
              onChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  enabledOntologyGroups: toggleSet(
                    filters.enabledOntologyGroups,
                    group,
                    checked,
                  ),
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="ontology-filter-group ontology-filter-fields">
        <legend>Field filters</legend>
        {(["label", "technicalName", "domain", "range"] as const).map(
          (field) => (
            <label key={field}>
              <span>{field === "technicalName" ? "Technical name" : field}</span>
              <input
                value={filters[field]}
                onChange={(event) =>
                  onFiltersChange({ ...filters, [field]: event.target.value })
                }
                placeholder={`Filter ${field}`}
              />
            </label>
          ),
        )}
      </fieldset>
    </aside>
  );
}
