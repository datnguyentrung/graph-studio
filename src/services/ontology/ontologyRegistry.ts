// import commercialLoansRaw from "../../../data/ontology/LOAN/LoansSpecific/CommercialLoans.ontology.json?raw";
import raw from "../../../data/ontology/all.ontology.json?raw";
import { parseOntologyJson } from "./parseOntologyJson";
import type { OntologyDocument } from "./types";

export type OntologySourceDefinition = {
  slug: string;
  label: string;
  load: () => OntologyDocument;
};

export const ontologySources: OntologySourceDefinition[] = [
  {
    slug: "loans",
    label: "Loans",
    load: () => parseOntologyJson(raw),
  },
];

export function loadDefaultOntology(): OntologyDocument {
  const defaultSource = ontologySources[0];

  if (!defaultSource) {
    throw new Error("No ontology data source is registered.");
  }

  return defaultSource.load();
}
