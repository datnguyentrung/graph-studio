import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

export type RoutePageProps = {
  subPath: string;
  search: string;
};

export type AppRoute = {
  segment: string;
  component: LazyExoticComponent<ComponentType<RoutePageProps>>;
};

export const APP_ROUTES: AppRoute[] = [
  {
    segment: "mermaid",
    component: lazy(() => import("../pages/mermaid/MermaidPage")),
  },
  {
    segment: "ontology",
    component: lazy(() => import("../pages/ontology/OntologyPage")),
  },
];

export function findAppRoute(segment: string): AppRoute | undefined {
  return APP_ROUTES.find((route) => route.segment === segment);
}
