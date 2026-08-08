import { findAppRoute, type AppRoute } from "./routeConfig";

export type ResolvedRoute =
  | {
      kind: "page";
      route: AppRoute;
      segment: string;
      subPath: string;
    }
  | {
      kind: "not-found";
      segment: string;
      subPath: string;
    };

export function resolveRoute(pathname: string): ResolvedRoute {
  const segments = pathname.split("/").filter(Boolean);
  const segment = (segments[0] ?? "ontology").toLowerCase();
  const subPath = segments.slice(1).join("/");

  const route = findAppRoute(segment);

  if (route) {
    return { kind: "page", route, segment, subPath };
  }

  return { kind: "not-found", segment, subPath };
}
