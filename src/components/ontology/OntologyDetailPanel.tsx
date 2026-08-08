import type {
  CytoscapeGraphModel,
  OntologyEdgeData,
  OntologyNodeData,
  OntologyProperty,
} from "../../services/ontology/types";

type OntologyDetailPanelProps = {
  model: CytoscapeGraphModel;
  selectedIds: string[];
};

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
}) {
  const display = Array.isArray(value)
    ? value.join(", ")
    : String(value ?? "").trim();
  return (
    <div className="ontology-detail__field">
      <dt>{label}</dt>
      <dd className={mono ? "ontology-mono" : undefined}>{display || "—"}</dd>
    </div>
  );
}

function PropertyList({ properties }: { properties: OntologyProperty[] }) {
  if (properties.length === 0)
    return <p className="ontology-empty">No assigned properties.</p>;
  return (
    <ul className="ontology-detail__cards">
      {properties.map((property, index) => (
        <li
          key={`${property.iri ?? property.technicalName ?? property.name}-${index}`}
        >
          <strong>
            {property.label ?? property.name ?? "Unnamed property"}
          </strong>
          <span className="ontology-mono">{property.technicalName ?? "—"}</span>
          <small>Range: {property.range.join(", ") || "—"}</small>
        </li>
      ))}
    </ul>
  );
}

function NodeDetail({
  node,
  model,
}: {
  node: OntologyNodeData;
  model: CytoscapeGraphModel;
}) {
  const incoming = [...model.edgeIndex.values()].filter(
    (edge) => edge.target === node.id,
  );
  const outgoing = [...model.edgeIndex.values()].filter(
    (edge) => edge.source === node.id,
  );
  const properties = model.propertiesByNodeId.get(node.id) ?? [];

  return (
    <>
      <div className="ontology-detail__title">
        <span
          className={`ontology-badge ontology-badge--${node.nodeType.toLowerCase()}`}
        >
          {node.nodeType}
        </span>
        <h2>{node.label}</h2>
        <p>
          {node.definition || "No definition is available for this concept."}
        </p>
      </div>
      <dl className="ontology-detail__fields">
        <Field label="Name" value={node.name} />
        <Field label="Local name" value={node.localName} mono />
        <Field label="Technical name" value={node.technicalName} mono />
        <Field label="IRI" value={node.iri} mono />
        <Field label="Namespace" value={node.namespace} mono />
        <Field label="Parents" value={node.parents} />
        {node.nodeType === "PROPERTY" && (
          <>
            <Field label="Domain" value={node.domain} />
            <Field label="Range" value={node.range} />
          </>
        )}
      </dl>
      <section className="ontology-detail__section">
        <h3>
          Properties <span>{properties.length}</span>
        </h3>
        <PropertyList properties={properties} />
      </section>
      <section className="ontology-detail__section">
        <h3>
          Rules <span>{node.rules.length}</span>
        </h3>
        {node.rules.length ? (
          <ul className="ontology-detail__rules">
            {node.rules.map((rule, index) => (
              <li key={index}>
                {typeof rule === "string" ? rule : JSON.stringify(rule)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ontology-empty">No rules.</p>
        )}
      </section>
      <RelationshipList title="Incoming" edges={incoming} model={model} />
      <RelationshipList title="Outgoing" edges={outgoing} model={model} />
    </>
  );
}

function RelationshipList({
  title,
  edges,
  model,
}: {
  title: string;
  edges: OntologyEdgeData[];
  model: CytoscapeGraphModel;
}) {
  return (
    <section className="ontology-detail__section">
      <h3>
        {title} <span>{edges.length}</span>
      </h3>
      {edges.length ? (
        <ul className="ontology-detail__cards">
          {edges.map((edge) => (
            <li key={edge.id}>
              <strong>{edge.label}</strong>
              <span>
                {model.nodeIndex.get(edge.source)?.label ?? edge.source} →{" "}
                {model.nodeIndex.get(edge.target)?.label ?? edge.target}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ontology-empty">None.</p>
      )}
    </section>
  );
}

function EdgeDetail({
  edge,
  model,
}: {
  edge: OntologyEdgeData;
  model: CytoscapeGraphModel;
}) {
  return (
    <>
      <div className="ontology-detail__title">
        <span className="ontology-badge ontology-badge--edge">
          {edge.edgeType}
        </span>
        <h2>{edge.label}</h2>
        <p>
          {edge.definition ||
            "No definition is available for this relationship."}
        </p>
      </div>
      <dl className="ontology-detail__fields">
        <Field label="Name" value={edge.name} />
        <Field label="Technical name" value={edge.technicalName} mono />
        <Field
          label="Source"
          value={model.nodeIndex.get(edge.source)?.label ?? edge.source}
        />
        <Field
          label="Target"
          value={model.nodeIndex.get(edge.target)?.label ?? edge.target}
        />
        <Field label="Domain" value={edge.domain} />
        <Field label="Range" value={edge.range} />
        <Field label="Relationship type" value={edge.relationshipType} mono />
      </dl>
    </>
  );
}

export function OntologyDetailPanel({
  model,
  selectedIds,
}: OntologyDetailPanelProps) {
  if (selectedIds.length === 0) {
    return (
      <aside
        className="ontology-panel ontology-detail"
        aria-label="Selection details"
      >
        <div className="ontology-detail__empty-state">
          <span className="ontology-detail__glyph">◎</span>
          <h2>Inspect a concept</h2>
          <p>
            Select a node or relationship to read its ontology metadata and
            connections.
          </p>
        </div>
      </aside>
    );
  }

  if (selectedIds.length > 1) {
    const nodeCount = selectedIds.filter((id) =>
      model.nodeIndex.has(id),
    ).length;
    return (
      <aside
        className="ontology-panel ontology-detail"
        aria-label="Selection details"
      >
        <div className="ontology-detail__title">
          <span className="ontology-badge">MULTI-SELECT</span>
          <h2>{selectedIds.length} elements</h2>
          <p>
            {nodeCount} nodes and {selectedIds.length - nodeCount} relationships
            are selected.
          </p>
        </div>
      </aside>
    );
  }

  const id = selectedIds[0];
  const node = model.nodeIndex.get(id);
  const edge = model.edgeIndex.get(id);

  return (
    <aside
      className="ontology-panel ontology-detail"
      aria-label="Selection details"
    >
      {node ? (
        <NodeDetail node={node} model={model} />
      ) : edge ? (
        <EdgeDetail edge={edge} model={model} />
      ) : null}
    </aside>
  );
}
